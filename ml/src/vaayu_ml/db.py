"""PostGIS readers and writers for the model pipeline.

This module is the other half of the contract with the Spring Boot service.
Ingestion writes observations here; the models read them, and write predictions
back. The API only ever reads. Python is never in the HTTP request path.

Column names must match the Flyway migrations in
``backend/src/main/resources/db/migration`` exactly.

Three schema constraints shape every write below:

* ``grid_prediction`` requires all three quantiles and ``coverage_fraction``,
  with a CHECK on quantile ordering. There is no way to write a point estimate.
* ``forecast`` requires ``baseline_persistence``. There is no way to record a
  forecast without the number it must be compared against.
* ``gee_aod_snapshot`` forbids a value where ``coverage_fraction`` is zero, so
  joins must preserve gaps rather than dropping or filling them.
"""

from __future__ import annotations

import os
from datetime import UTC, datetime

import pandas as pd
from sqlalchemy import create_engine, text

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql+psycopg://vaayu:vaayu@localhost:5432/vaayu"
)

engine = create_engine(DATABASE_URL, future=True)

# Stand-in distance when no station exists at all. Large on purpose: the model
# should treat such a cell as far from ground truth rather than as adjacent to
# a station that is not there.
NO_STATION_DISTANCE_KM = 999.0


class EmptyTrainingSetError(RuntimeError):
    """Raised when a query the pipeline depends on returns nothing.

    Training on an empty frame produces a model that predicts a constant and
    reports a plausible-looking score. Failing loudly is the only safe option.
    """


# --------------------------------------------------------------------------
# Readers
# --------------------------------------------------------------------------


def load_grid_cells() -> pd.DataFrame:
    """Grid cells with their static covariates and centroid coordinates."""
    query = text("""
        SELECT id            AS grid_cell_id,
               code          AS grid_cell_code,
               ST_Y(centroid::geometry) AS centroid_lat,
               ST_X(centroid::geometry) AS centroid_lon,
               population,
               elevation_m,
               road_density  AS road_density_km_per_km2,
               built_up_fraction,
               district,
               state,
               covariate_source
        FROM grid_cell
        ORDER BY id
    """)
    with engine.begin() as connection:
        frame = pd.DataFrame(connection.execute(query).mappings().all())

    if frame.empty:
        raise EmptyTrainingSetError(
            "grid_cell is empty. Run `python -m vaayu_ml.build_grid` before training."
        )
    return frame


def load_station_readings(hours: int = 720) -> pd.DataFrame:
    """Observed station readings, which are the training target.

    Rows without a PM2.5 value are excluded here because they cannot serve as a
    target, not because they are bad data.
    """
    query = text("""
        SELECT r.station_id,
               r.ts,
               r.pm25,
               r.pm10,
               r.no2,
               r.source,
               ST_Y(s.geom::geometry) AS station_lat,
               ST_X(s.geom::geometry) AS station_lon
        FROM station_reading r
        JOIN station s ON s.id = r.station_id
        WHERE r.pm25 IS NOT NULL
          AND r.ts >= now() - make_interval(hours => :hours)
        ORDER BY r.ts
    """)
    with engine.begin() as connection:
        return pd.DataFrame(connection.execute(query, {"hours": hours}).mappings().all())


def load_feature_frame(hours: int = 720) -> pd.DataFrame:
    """Satellite and meteorological features joined per grid cell and hour.

    Uses FULL OUTER JOIN rather than INNER: a cell with meteorology but no AOD
    retrieval must survive as a row with a null AOD and zero coverage. An inner
    join would delete exactly the cloudy, high-pollution cells the project
    exists to reason about, and the deletion would be invisible.
    """
    query = text("""
        SELECT COALESCE(a.grid_cell_id, m.grid_cell_id, s.grid_cell_id) AS grid_cell_id,
               COALESCE(a.ts, m.ts, s.ts)                               AS ts,
               a.aod_047,
               a.aod_055,
               a.aod_uncertainty,
               a.column_wv,
               COALESCE(a.coverage_fraction, 0.0) AS aod_coverage_fraction,
               s.no2_column,
               s.aer_ai,
               COALESCE(s.coverage_fraction, 0.0) AS s5p_coverage_fraction,
               m.boundary_layer_height AS blh,
               m.wind_u,
               m.wind_v,
               m.temp_2m,
               m.relative_humidity AS rh,
               m.surface_pressure,
               m.precipitation
        FROM gee_aod_snapshot a
        FULL OUTER JOIN (
            -- Filtered in a subquery, not in the JOIN's ON clause. A FULL OUTER
            -- JOIN preserves unmatched rows from both sides, so `AND m.kind =
            -- 'REANALYSIS'` in the ON clause did not exclude FORECAST rows: it
            -- only stopped them matching, and they still arrived as met-only
            -- rows. Those carry future valid_at times, so they became training
            -- examples dated in the future and were written back as
            -- future-timestamped grid_prediction rows, which the API's
            -- `ORDER BY ts DESC LIMIT 1` then served as the current nowcast.
            SELECT * FROM met_snapshot WHERE kind = 'REANALYSIS'
        ) m
               ON m.grid_cell_id = a.grid_cell_id
              AND m.ts = a.ts
        FULL OUTER JOIN gee_s5p_snapshot s
               ON s.grid_cell_id = COALESCE(a.grid_cell_id, m.grid_cell_id)
              AND s.ts = COALESCE(a.ts, m.ts)
        WHERE COALESCE(a.ts, m.ts, s.ts) >= now() - make_interval(hours => :hours)
          -- Never train on a snapshot valid in the future.
          AND COALESCE(a.ts, m.ts, s.ts) <= now()
    """)
    with engine.begin() as connection:
        return pd.DataFrame(connection.execute(query, {"hours": hours}).mappings().all())


def load_station_cell_map() -> pd.DataFrame:
    """Map each station to the grid cell containing it, else the nearest one.

    Stations near the pilot boundary fall outside every cell, and dropping them
    would discard exactly the peripheral ground truth the surface is weakest at.
    The distance is returned so a caller can exclude stations too far outside
    the grid to be meaningful.
    """
    query = text("""
        SELECT s.id AS station_id,
               c.id AS grid_cell_id,
               c.code AS grid_cell_code,
               ST_Distance(s.geom, c.centroid) / 1000.0 AS distance_km
        FROM station s
        CROSS JOIN LATERAL (
            SELECT id, code, centroid
            FROM grid_cell
            WHERE covariate_source <> 'SEED'
            ORDER BY geom <-> s.geom::geometry
            LIMIT 1
        ) c
    """)
    with engine.begin() as connection:
        return pd.DataFrame(connection.execute(query).mappings().all())


def load_cell_station_distance() -> pd.DataFrame:
    """Distance from each grid cell to the nearest monitoring station.

    This is a model feature, not a diagnostic. Interpolation is trustworthy
    near a station and degrades with distance, so the model needs to know how
    far from ground truth each prediction sits. It is also what the console
    uses to decide whether a cell should be shown as an estimate.
    """
    query = text("""
        SELECT c.id AS grid_cell_id,
               COALESCE(
                   (SELECT ST_Distance(c.centroid, s.geom) / 1000.0
                    FROM station s
                    ORDER BY s.geom <-> c.centroid::geometry
                    LIMIT 1),
                   :fallback_km
               ) AS distance_to_nearest_station_km
        FROM grid_cell c
    """)
    with engine.begin() as connection:
        return pd.DataFrame(
            connection.execute(query, {"fallback_km": NO_STATION_DISTANCE_KM}).mappings().all()
        )


def load_fire_clusters(days: int = 7) -> pd.DataFrame:
    """Fire clusters with their centroid coordinates, for attribution."""
    query = text("""
        SELECT id AS fire_cluster_id,
               code,
               detection_date,
               ST_Y(centroid::geometry) AS lat,
               ST_X(centroid::geometry) AS lon,
               detection_count,
               total_frp,
               tehsil,
               district,
               state
        FROM fire_cluster
        WHERE detection_date >= current_date - make_interval(days => :days)
        ORDER BY total_frp DESC
    """)
    with engine.begin() as connection:
        return pd.DataFrame(connection.execute(query, {"days": days}).mappings().all())


def latest_met_by_cell() -> pd.DataFrame:
    """Most recent reanalysis wind per cell, for the back-trajectory."""
    query = text("""
        SELECT DISTINCT ON (grid_cell_id)
               grid_cell_id, ts, wind_u, wind_v, boundary_layer_height AS blh
        FROM met_snapshot
        WHERE kind = 'REANALYSIS'
        ORDER BY grid_cell_id, ts DESC
    """)
    with engine.begin() as connection:
        return pd.DataFrame(connection.execute(query).mappings().all())


# --------------------------------------------------------------------------
# Writers
# --------------------------------------------------------------------------

_INSERT_GRID_PREDICTION = text("""
    INSERT INTO grid_prediction
        (grid_cell_id, ts, pm25_q10, pm25_q50, pm25_q90,
         coverage_fraction, model_version, source)
    VALUES (:grid_cell_id, :ts, :pm25_q10, :pm25_q50, :pm25_q90,
            :coverage_fraction, :model_version, :source)
    ON CONFLICT (grid_cell_id, ts, model_version) DO UPDATE SET
        pm25_q10 = EXCLUDED.pm25_q10,
        pm25_q50 = EXCLUDED.pm25_q50,
        pm25_q90 = EXCLUDED.pm25_q90,
        coverage_fraction = EXCLUDED.coverage_fraction
""")


def write_grid_predictions(frame: pd.DataFrame, model_version: str, source: str) -> int:
    """Write the nowcast surface.

    Quantiles are sorted per row before writing. Quantile regression fits each
    quantile independently, so nothing guarantees q10 <= q50 <= q90 at
    prediction time -- crossing is a known artefact. The schema rejects crossed
    intervals, so sorting here turns a hard failure into the monotone envelope
    the constraint expects.
    """
    if frame.empty:
        return 0

    required = {"grid_cell_id", "ts", "pm25_q10", "pm25_q50", "pm25_q90"}
    missing = required - set(frame.columns)
    if missing:
        raise ValueError(f"grid predictions missing columns: {sorted(missing)}")

    quantiles = frame[["pm25_q10", "pm25_q50", "pm25_q90"]].to_numpy()
    quantiles.sort(axis=1)

    rows = []
    for (_, record), (low, mid, high) in zip(frame.iterrows(), quantiles, strict=True):
        rows.append(
            {
                "grid_cell_id": int(record["grid_cell_id"]),
                "ts": record["ts"],
                "pm25_q10": float(low),
                "pm25_q50": float(mid),
                "pm25_q90": float(high),
                "coverage_fraction": float(record.get("coverage_fraction", 0.0) or 0.0),
                "model_version": model_version,
                "source": source,
            }
        )

    with engine.begin() as connection:
        connection.execute(_INSERT_GRID_PREDICTION, rows)
    return len(rows)


_INSERT_FORECAST = text("""
    INSERT INTO forecast
        (station_id, grid_cell_id, issued_at, horizon_hours, valid_at,
         pm25, aqi, ci_low, ci_high, baseline_persistence, baseline_cams,
         model_version, source)
    VALUES (:station_id, :grid_cell_id, :issued_at, :horizon_hours, :valid_at,
            :pm25, :aqi, :ci_low, :ci_high, :baseline_persistence, :baseline_cams,
            :model_version, :source)
    ON CONFLICT (station_id, grid_cell_id, issued_at, horizon_hours, model_version) DO UPDATE SET
        valid_at = EXCLUDED.valid_at,
        pm25 = EXCLUDED.pm25,
        aqi = EXCLUDED.aqi,
        ci_low = EXCLUDED.ci_low,
        ci_high = EXCLUDED.ci_high,
        baseline_persistence = EXCLUDED.baseline_persistence,
        baseline_cams = EXCLUDED.baseline_cams,
        source = EXCLUDED.source
""")


def write_forecasts(frame: pd.DataFrame, model_version: str, source: str) -> int:
    """Write multi-horizon forecasts.

    baseline_persistence is required by the schema and is not defaulted here.
    A forecast whose baseline could not be computed is a forecast that cannot be
    evaluated, and writing a placeholder would hide that.
    """
    if frame.empty:
        return 0

    if "baseline_persistence" not in frame.columns:
        raise ValueError(
            "forecasts have no baseline_persistence; the schema requires the "
            "number the model must be compared against"
        )
    if frame["baseline_persistence"].isna().any():
        raise ValueError("some forecasts have a null baseline_persistence")

    rows = [
        {
            "station_id": int(r["station_id"]) if pd.notna(r.get("station_id")) else None,
            "grid_cell_id": int(r["grid_cell_id"]) if pd.notna(r.get("grid_cell_id")) else None,
            "issued_at": r["issued_at"],
            "horizon_hours": int(r["horizon_hours"]),
            "valid_at": r["valid_at"],
            "pm25": float(r["pm25"]),
            "aqi": int(r["aqi"]),
            "ci_low": float(r["ci_low"]),
            "ci_high": float(r["ci_high"]),
            "baseline_persistence": float(r["baseline_persistence"]),
            "baseline_cams": float(r["baseline_cams"])
            if pd.notna(r.get("baseline_cams"))
            else None,
            "model_version": model_version,
            "source": source,
        }
        for _, r in frame.iterrows()
    ]

    with engine.begin() as connection:
        connection.execute(_INSERT_FORECAST, rows)
    return len(rows)


_INSERT_IMPACT = text("""
    INSERT INTO fire_cluster_impact
        (fire_cluster_id, receptor, impact_score, impact_rank, downwind_population,
         transport_hours, trajectory_confidence, consecutive_days_unactioned,
         model_version, source)
    VALUES (:fire_cluster_id, :receptor, :impact_score, :impact_rank,
            :downwind_population, :transport_hours, :trajectory_confidence,
            :consecutive_days_unactioned, :model_version, :source)
    ON CONFLICT (fire_cluster_id, receptor, model_version) DO UPDATE SET
        impact_score = EXCLUDED.impact_score,
        impact_rank = EXCLUDED.impact_rank,
        downwind_population = EXCLUDED.downwind_population,
        transport_hours = EXCLUDED.transport_hours,
        trajectory_confidence = EXCLUDED.trajectory_confidence
""")


def write_cluster_impacts(frame: pd.DataFrame, model_version: str, source: str) -> int:
    """Write the ranked enforcement worklist."""
    if frame.empty:
        return 0

    rows = [
        {
            "fire_cluster_id": int(r["fire_cluster_id"]),
            "receptor": str(r.get("receptor", "DELHI-NCR")),
            "impact_score": float(r["impact_score"]),
            "impact_rank": int(r["impact_rank"]),
            "downwind_population": int(r["downwind_population"])
            if pd.notna(r.get("downwind_population"))
            else None,
            "transport_hours": float(r["transport_hours"])
            if pd.notna(r.get("transport_hours"))
            else None,
            "trajectory_confidence": float(r["trajectory_confidence"])
            if pd.notna(r.get("trajectory_confidence"))
            else None,
            "consecutive_days_unactioned": int(r.get("consecutive_days_unactioned", 0) or 0),
            "model_version": model_version,
            "source": source,
        }
        for _, r in frame.iterrows()
    ]

    with engine.begin() as connection:
        connection.execute(_INSERT_IMPACT, rows)
    return len(rows)


def record_model_run(
    model_name: str, model_version: str, metrics: dict, notes: str | None = None
) -> None:
    """Record provenance so any prediction resolves back to the run behind it."""
    import json

    with engine.begin() as connection:
        connection.execute(
            text("""
                INSERT INTO model_run (model_name, model_version, trained_at, metrics, notes)
                VALUES (:model_name, :model_version, :trained_at, CAST(:metrics AS jsonb), :notes)
                ON CONFLICT (model_name, model_version) DO UPDATE SET
                    trained_at = EXCLUDED.trained_at,
                    metrics = EXCLUDED.metrics,
                    notes = EXCLUDED.notes
            """),
            {
                "model_name": model_name,
                "model_version": model_version,
                "trained_at": datetime.now(UTC),
                "metrics": json.dumps(metrics),
                "notes": notes,
            },
        )
