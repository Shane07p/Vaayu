"""Fire-cluster attribution pipeline: PostGIS in, PostGIS out."""

from __future__ import annotations

import argparse
from collections.abc import Callable

import numpy as np
import pandas as pd

from vaayu_ml.attribution.rank import rank_fire_clusters
from vaayu_ml.db import (
    EmptyTrainingSetError,
    latest_met_by_cell,
    load_fire_clusters,
    load_grid_cells,
    record_model_run,
    write_cluster_impacts,
)
from vaayu_ml.features.align import haversine_distance
from vaayu_ml.trajectory import back_trajectory

MODEL_NAME = "fire_cluster_attribution"
MODEL_VERSION = "attribution-trajectory-v1"
DELHI_NCR_LAT = 28.6139
DELHI_NCR_LON = 77.2090
MAX_WIND_CELL_DISTANCE_KM = 100.0


def validate_clusters(clusters: pd.DataFrame) -> pd.DataFrame:
    """Validate the database cluster fields needed by the ranking pipeline."""
    required = {"fire_cluster_id", "lat", "lon", "total_frp"}
    missing = required - set(clusters.columns)
    if missing:
        raise ValueError(f"fire clusters missing columns: {sorted(missing)}")

    result = clusters.copy()
    numeric = result[["lat", "lon", "total_frp"]].apply(pd.to_numeric, errors="coerce")
    if not np.isfinite(numeric.to_numpy(dtype=float)).all():
        raise ValueError("fire clusters contain a non-finite coordinate or fire radiative power")
    if (numeric["lat"].abs() > 90).any() or (numeric["lon"].abs() > 180).any():
        raise ValueError("fire clusters contain an invalid latitude or longitude")
    if (numeric["total_frp"] < 0).any():
        raise ValueError("fire clusters contain a negative fire radiative power")
    if result["fire_cluster_id"].isna().any():
        raise ValueError("fire clusters contain a missing cluster identifier")
    return result


def wind_function(
    met: pd.DataFrame, cells: pd.DataFrame
) -> Callable[[float, float], tuple[float, float] | None]:
    """Return a nearest-cell wind lookup backed only by valid stored winds."""
    required_met = {"grid_cell_id", "wind_u", "wind_v"}
    missing_met = required_met - set(met.columns)
    if missing_met:
        raise ValueError(f"meteorological data missing columns: {sorted(missing_met)}")
    required_cells = {"grid_cell_id", "centroid_lat", "centroid_lon"}
    missing_cells = required_cells - set(cells.columns)
    if missing_cells:
        raise ValueError(f"grid cells missing columns: {sorted(missing_cells)}")

    field = met.merge(
        cells[["grid_cell_id", "centroid_lat", "centroid_lon"]], on="grid_cell_id", how="inner"
    )
    numeric = field[["centroid_lat", "centroid_lon", "wind_u", "wind_v"]].apply(
        pd.to_numeric, errors="coerce"
    )
    field = field.loc[np.isfinite(numeric.to_numpy(dtype=float)).all(axis=1)].copy()
    if field.empty:
        raise EmptyTrainingSetError("No usable wind vectors are available for attribution.")

    latitudes = field["centroid_lat"].to_numpy(dtype=float)
    longitudes = field["centroid_lon"].to_numpy(dtype=float)
    wind_u = field["wind_u"].to_numpy(dtype=float)
    wind_v = field["wind_v"].to_numpy(dtype=float)

    def lookup(latitude: float, longitude: float) -> tuple[float, float] | None:
        distances = haversine_distance(latitude, longitude, latitudes, longitudes)
        nearest = int(np.argmin(distances))
        if distances[nearest] > MAX_WIND_CELL_DISTANCE_KM:
            return None
        return float(wind_u[nearest]), float(wind_v[nearest])

    return lookup


def validate_output(frame: pd.DataFrame) -> None:
    """Ensure the worklist contains complete, physically meaningful rows."""
    required = {
        "fire_cluster_id",
        "receptor",
        "impact_score",
        "impact_rank",
        "transport_hours",
        "trajectory_confidence",
    }
    missing = required - set(frame.columns)
    if missing:
        raise ValueError(f"cluster impact output missing columns: {sorted(missing)}")
    if frame["fire_cluster_id"].isna().any() or frame["receptor"].isna().any():
        raise ValueError("cluster impact output has a missing cluster identifier or receptor")

    values = frame[
        ["impact_score", "impact_rank", "transport_hours", "trajectory_confidence"]
    ].apply(pd.to_numeric, errors="coerce")
    if not np.isfinite(values.to_numpy(dtype=float)).all():
        raise ValueError("cluster impact output contains a non-finite value")
    if (values["impact_score"] < 0).any() or (values["impact_rank"] < 1).any():
        raise ValueError("cluster impact output contains an invalid score or rank")
    if (values["transport_hours"] < 0).any():
        raise ValueError("cluster impact output contains a negative transport time")
    if ((values["trajectory_confidence"] < 0) | (values["trajectory_confidence"] > 1)).any():
        raise ValueError("cluster impact output has confidence outside [0, 1]")


def run(
    days: int = 7,
    trajectory_hours: int = 48,
    receptor: str = "DELHI-NCR",
    dry_run: bool = False,
) -> None:
    """Rank recent stored fire clusters for the configured receptor."""
    if days < 1:
        raise ValueError("days must be at least one")
    if trajectory_hours < 1:
        raise ValueError("trajectory_hours must be at least one")

    clusters = load_fire_clusters(days=days)
    if clusters.empty:
        print("No fire clusters available for attribution")
        return
    clusters = validate_clusters(clusters)

    met = latest_met_by_cell()
    if met.empty:
        raise EmptyTrainingSetError("No meteorological wind data is available for attribution.")
    cells = load_grid_cells()
    winds = wind_function(met, cells)
    if "population" not in cells.columns:
        raise ValueError("grid cells missing population required for downwind impact ranking")
    population = pd.to_numeric(cells["population"], errors="coerce")
    if not np.isfinite(population.to_numpy(dtype=float)).all() or (population < 0).any():
        raise ValueError("grid cells contain an invalid population for downwind impact ranking")

    waypoints = back_trajectory(DELHI_NCR_LAT, DELHI_NCR_LON, winds, hours=trajectory_hours)
    completed_steps = len(waypoints) - 1
    if completed_steps <= 0:
        raise EmptyTrainingSetError("No usable wind path is available for attribution.")

    trajectory_confidence = completed_steps / trajectory_hours
    ranked = rank_fire_clusters(
        clusters.assign(trajectory_confidence=trajectory_confidence),
        {receptor: waypoints},
        pd.DataFrame({"population": population}),
        receptor=receptor,
    )
    if ranked.empty:
        print("No fire-cluster impacts were produced for attribution")
        return

    ranked = ranked.copy()
    ranked["receptor"] = receptor
    validate_output(ranked)

    if dry_run:
        print(f"dry run: would write {len(ranked)} fire-cluster impacts")
        print(ranked.head(10).to_string(index=False))
        return

    written = write_cluster_impacts(ranked, MODEL_VERSION, source="MODEL")
    record_model_run(
        MODEL_NAME,
        MODEL_VERSION,
        {
            "n_clusters": int(len(clusters)),
            "n_impacts": int(len(ranked)),
            "trajectory_confidence": float(trajectory_confidence),
        },
        notes="Nearest-cell reanalysis wind trajectory; single-particle approximation.",
    )
    print(f"written={written} model_version={MODEL_VERSION}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the fire-cluster attribution pipeline")
    parser.add_argument("--days", type=int, default=7)
    parser.add_argument("--trajectory-hours", type=int, default=48)
    parser.add_argument("--receptor", default="DELHI-NCR")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    run(
        days=args.days,
        trajectory_hours=args.trajectory_hours,
        receptor=args.receptor,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    main()
