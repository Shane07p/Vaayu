"""PostGIS writers.

This module is the entire contract between Python and Java: Python writes here,
the Spring Boot service reads. Column names must match the Flyway migrations in
``backend/src/main/resources/db/migration`` exactly, and neither side changes a
table the other depends on without a migration.

Implement:
    ``write_station_readings(records, mode) -> int``
    ``write_fire_detections(records, mode) -> int``
    ``record_run(source, mode, status, row_count, error) -> None``

``record_run`` must distinguish ``SOURCE_UNAVAILABLE`` from ``FAILED``: the
first means the upstream is down, the second means our job broke, and the
console shows them differently.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from hashlib import sha256
from zoneinfo import ZoneInfo

from sqlalchemy import create_engine, text

from ingestion.settings import settings

engine = create_engine(settings.database_url, future=True)

IST = ZoneInfo("Asia/Kolkata")


def _station_code(name: str, source: str) -> str:
    digest = sha256(f"{source}:{name}".encode()).hexdigest()[:16]
    return f"{source}-{digest}"


def _as_float(value: object) -> float | None:
    if value in (None, "", "NA", "N/A"):
        return None
    return float(str(value))


def _cpcb_timestamp(value: object) -> datetime:
    if not isinstance(value, str):
        raise ValueError("CPCB reading has no timestamp")
    parsed = datetime.strptime(value, "%d-%m-%Y %H:%M:%S").replace(tzinfo=IST)
    return parsed.astimezone(ZoneInfo("UTC"))


def _station_timestamp(record: dict) -> datetime:
    """Parse a canonical station timestamp without losing its timezone."""
    if record.get("station_source") != "OPENAQ":
        return _cpcb_timestamp(record.get("last_update"))

    value = record.get("last_update")
    if not isinstance(value, str):
        raise ValueError("OpenAQ reading has no UTC timestamp")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("OpenAQ reading has an invalid UTC timestamp") from exc
    if parsed.tzinfo is None:
        raise ValueError("OpenAQ reading timestamp must include a timezone")
    return parsed.astimezone(ZoneInfo("UTC"))


def write_station_readings(records: list[dict], mode: str) -> int:
    """Upsert canonical CPCB and OpenAQ station readings atomically."""
    grouped: dict[tuple[str, str, datetime], dict] = defaultdict(dict)
    for record in records:
        station_name = record.get("station")
        if not isinstance(station_name, str) or not station_name:
            raise ValueError("station reading has no station name")
        station_source = str(record.get("station_source") or "CPCB")
        timestamp = _station_timestamp(record)
        entry = grouped[(station_source, station_name, timestamp)]
        entry.update(record)
        pollutant = str(record.get("pollutant_id", "")).upper().replace(".", "")
        if pollutant in {"PM25", "PM10", "NO2", "SO2", "CO", "O3"}:
            entry[pollutant] = _as_float(record.get("pollutant_avg"))

    with engine.begin() as connection:
        for (station_source, name, timestamp), record in grouped.items():
            latitude = _as_float(record.get("latitude"))
            longitude = _as_float(record.get("longitude"))
            if (
                latitude is None
                or longitude is None
                or not -90 <= latitude <= 90
                or not -180 <= longitude <= 180
            ):
                raise ValueError(f"station reading for {name!r} has invalid coordinates")
            code = _station_code(name, station_source)
            station_id = connection.execute(
                text(
                    """
                    INSERT INTO station (code, name, city, state, geom, source)
                    VALUES (:code, :name, :city, :state,
                            ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography,
                            :source)
                    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name,
                        city = EXCLUDED.city, state = EXCLUDED.state
                    RETURNING id
                    """
                ),
                {
                    "code": code,
                    "name": name,
                    "city": record.get("city"),
                    "state": record.get("state"),
                    "longitude": longitude,
                    "latitude": latitude,
                    "source": mode,
                },
            ).scalar_one()
            connection.execute(
                text(
                    """
                    INSERT INTO station_reading
                        (station_id, ts, pm25, pm10, no2, so2, co, o3, source)
                    VALUES (:station_id, :ts, :pm25, :pm10, :no2, :so2, :co, :o3, :source)
                    ON CONFLICT (station_id, ts, source) DO UPDATE SET
                        pm25 = EXCLUDED.pm25, pm10 = EXCLUDED.pm10, no2 = EXCLUDED.no2,
                        so2 = EXCLUDED.so2, co = EXCLUDED.co, o3 = EXCLUDED.o3,
                        ingested_at = now()
                    """
                ),
                {
                    "station_id": station_id,
                    "ts": timestamp,
                    "pm25": record.get("PM25"),
                    "pm10": record.get("PM10"),
                    "no2": record.get("NO2"),
                    "so2": record.get("SO2"),
                    "co": record.get("CO"),
                    "o3": record.get("O3"),
                    "source": mode,
                },
            )
    return len(grouped)


def write_fire_detections(records: list[dict], mode: str) -> int:
    """Write validated FIRMS CSV detections in one transaction."""
    rows = []
    for record in records:
        latitude = _as_float(record.get("latitude"))
        longitude = _as_float(record.get("longitude"))
        if (
            latitude is None
            or longitude is None
            or not -90 <= latitude <= 90
            or not -180 <= longitude <= 180
        ):
            raise ValueError("FIRMS record has invalid coordinates")
        acquired = f"{record.get('acq_date')} {str(record.get('acq_time', '0')).zfill(4)}"
        timestamp = datetime.strptime(acquired, "%Y-%m-%d %H%M").replace(tzinfo=ZoneInfo("UTC"))
        rows.append(
            {
                "external_id": f"{latitude}:{longitude}:{acquired}",
                "ts": timestamp,
                "latitude": latitude,
                "longitude": longitude,
                "frp": _as_float(record.get("frp")),
                "confidence": str(record.get("confidence") or "unknown"),
                "sensor": str(record.get("satellite") or "VIIRS_SNPP"),
                "source": mode,
            }
        )
    with engine.begin() as connection:
        for row in rows:
            connection.execute(
                text(
                    """
                    INSERT INTO fire_detection
                        (external_id, ts, geom, frp, confidence, sensor, source)
                    VALUES
                        (:external_id, :ts,
                         ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography,
                         :frp, :confidence, :sensor, :source)
                    ON CONFLICT (external_id) WHERE external_id IS NOT NULL DO UPDATE SET
                        ts = EXCLUDED.ts, geom = EXCLUDED.geom, frp = EXCLUDED.frp,
                        confidence = EXCLUDED.confidence, sensor = EXCLUDED.sensor,
                        source = EXCLUDED.source, ingested_at = now()
                    """
                ),
                row,
            )
    return len(rows)


def _resolve_grid_cell_ids(connection, codes: set[str]) -> dict[str, int]:
    """Map grid cell codes to ids, rejecting codes the grid does not contain.

    A snapshot row for an unknown cell is a bug in the reduction, not a row to
    skip quietly: it means the Earth Engine grid and the PostGIS grid have
    drifted apart, and every downstream join would be silently wrong.
    """
    if not codes:
        return {}

    rows = connection.execute(
        text("SELECT code, id FROM grid_cell WHERE code = ANY(:codes)"),
        {"codes": list(codes)},
    ).all()
    resolved = {code: identifier for code, identifier in rows}

    missing = codes - resolved.keys()
    if missing:
        sample = ", ".join(sorted(missing)[:5])
        raise ValueError(
            f"{len(missing)} snapshot rows reference unknown grid cells (e.g. {sample}). "
            f"The Earth Engine grid and grid_cell have diverged."
        )
    return resolved


def _snapshot_rows(records: list[dict], connection) -> list[tuple[int, dict]]:
    # A record with no grid cell code is a bug in the reduction, not a row to
    # skip. Dropping it silently would shrink row_count while the run still
    # reported SUCCESS, which is the same class of dishonesty as filling a gap.
    unlabelled = sum(1 for record in records if not record.get("grid_cell_code"))
    if unlabelled:
        raise ValueError(
            f"{unlabelled} of {len(records)} snapshot records carry no grid_cell_code; "
            f"the reduction did not attach cell identity"
        )

    codes = {str(record["grid_cell_code"]) for record in records}
    identifiers = _resolve_grid_cell_ids(connection, codes)
    return [(identifiers[str(record["grid_cell_code"])], record) for record in records]


def write_aod_snapshot(records: list[dict], mode: str) -> int:
    """Write MAIAC AOD onto the grid, preserving zero-coverage cells.

    A cell the satellite could not see is written with coverage_fraction 0 and
    null values rather than dropped. Dropping it would make a gap
    indistinguishable from clean air downstream.
    """
    if not records:
        return 0

    with engine.begin() as connection:
        rows = _snapshot_rows(records, connection)
        for grid_cell_id, record in rows:
            coverage = float(record.get("coverage_fraction") or 0.0)
            has_signal = coverage > 0
            connection.execute(
                text(
                    """
                    INSERT INTO gee_aod_snapshot
                        (grid_cell_id, ts, aod_047, aod_055, aod_uncertainty,
                         column_wv, coverage_fraction, qa_passed, source)
                    VALUES (:grid_cell_id, :ts, :aod_047, :aod_055, :aod_uncertainty,
                            :column_wv, :coverage_fraction, :qa_passed, :source)
                    ON CONFLICT (grid_cell_id, ts) DO UPDATE SET
                        aod_047 = EXCLUDED.aod_047, aod_055 = EXCLUDED.aod_055,
                        aod_uncertainty = EXCLUDED.aod_uncertainty,
                        column_wv = EXCLUDED.column_wv,
                        coverage_fraction = EXCLUDED.coverage_fraction,
                        qa_passed = EXCLUDED.qa_passed, ingested_at = now()
                    """
                ),
                {
                    "grid_cell_id": grid_cell_id,
                    "ts": record["ts"],
                    "aod_047": _as_float(record.get("aod_047")) if has_signal else None,
                    "aod_055": _as_float(record.get("aod_055")) if has_signal else None,
                    "aod_uncertainty": _as_float(record.get("aod_uncertainty")),
                    "column_wv": _as_float(record.get("column_wv")),
                    "coverage_fraction": coverage,
                    "qa_passed": bool(record.get("qa_passed", has_signal)),
                    "source": mode,
                },
            )
    return len(rows)


def write_s5p_snapshot(records: list[dict], mode: str) -> int:
    """Write Sentinel-5P columns onto the grid.

    Negative NO2 columns are written unchanged. They are the instrument's noise
    floor over clean air, and clipping them biases the feature upward exactly
    where the air is cleanest.
    """
    if not records:
        return 0

    with engine.begin() as connection:
        rows = _snapshot_rows(records, connection)
        for grid_cell_id, record in rows:
            connection.execute(
                text(
                    """
                    INSERT INTO gee_s5p_snapshot
                        (grid_cell_id, ts, no2_column, aer_ai, coverage_fraction, source)
                    VALUES (:grid_cell_id, :ts, :no2_column, :aer_ai,
                            :coverage_fraction, :source)
                    ON CONFLICT (grid_cell_id, ts) DO UPDATE SET
                        no2_column = EXCLUDED.no2_column, aer_ai = EXCLUDED.aer_ai,
                        coverage_fraction = EXCLUDED.coverage_fraction,
                        ingested_at = now()
                    """
                ),
                {
                    "grid_cell_id": grid_cell_id,
                    "ts": record["ts"],
                    "no2_column": _as_float(record.get("no2_column")),
                    "aer_ai": _as_float(record.get("aer_ai")),
                    "coverage_fraction": float(record.get("coverage_fraction") or 0.0),
                    "source": mode,
                },
            )
    return len(rows)


def write_met_snapshot(records: list[dict], mode: str) -> int:
    """Write meteorology onto the grid, keyed by (cell, ts, kind).

    REANALYSIS and FORECAST rows coexist for the same cell and timestamp on
    purpose: the nowcast trains on what the weather was, the forecast runs on
    what it is expected to be, and conflating them would leak the future.
    """
    if not records:
        return 0

    with engine.begin() as connection:
        rows = _snapshot_rows(records, connection)
        for grid_cell_id, record in rows:
            kind = str(record.get("kind") or "REANALYSIS")
            if kind not in {"REANALYSIS", "FORECAST"}:
                raise ValueError("met kind must be REANALYSIS or FORECAST")
            connection.execute(
                text(
                    """
                    INSERT INTO met_snapshot
                        (grid_cell_id, ts, kind, boundary_layer_height, wind_u, wind_v,
                         temp_2m, relative_humidity, surface_pressure, precipitation,
                         source)
                    VALUES (:grid_cell_id, :ts, :kind, :boundary_layer_height,
                            :wind_u, :wind_v, :temp_2m, :relative_humidity,
                            :surface_pressure, :precipitation, :source)
                    ON CONFLICT (grid_cell_id, ts, kind) DO UPDATE SET
                        boundary_layer_height = EXCLUDED.boundary_layer_height,
                        wind_u = EXCLUDED.wind_u, wind_v = EXCLUDED.wind_v,
                        temp_2m = EXCLUDED.temp_2m,
                        relative_humidity = EXCLUDED.relative_humidity,
                        surface_pressure = EXCLUDED.surface_pressure,
                        precipitation = EXCLUDED.precipitation,
                        ingested_at = now()
                    """
                ),
                {
                    "grid_cell_id": grid_cell_id,
                    "ts": record["ts"],
                    "kind": kind,
                    "boundary_layer_height": _as_float(record.get("boundary_layer_height")),
                    "wind_u": _as_float(record.get("wind_u")),
                    "wind_v": _as_float(record.get("wind_v")),
                    "temp_2m": _as_float(record.get("temp_2m")),
                    "relative_humidity": _as_float(record.get("relative_humidity")),
                    "surface_pressure": _as_float(record.get("surface_pressure")),
                    "precipitation": _as_float(record.get("precipitation")),
                    "source": mode,
                },
            )
    return len(rows)


def record_run(
    source: str,
    mode: str,
    status: str,
    row_count: int | None = None,
    error: str | None = None,
) -> None:
    """Record completion without erasing the distinction between source and job failures."""
    if status not in {"SUCCESS", "SOURCE_UNAVAILABLE", "FAILED"}:
        raise ValueError("status must be SUCCESS, SOURCE_UNAVAILABLE, or FAILED")
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                INSERT INTO ingestion_run
                    (source, mode, started_at, finished_at, status, row_count, error)
                VALUES (:source, :mode, now(), now(), :status, :row_count, :error)
                """
            ),
            {
                "source": source,
                "mode": mode,
                "status": status,
                "row_count": row_count,
                "error": error,
            },
        )
