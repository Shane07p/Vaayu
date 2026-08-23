"""Nowcast pipeline: PostGIS in, PostGIS out.

Reads observations from the database, trains the quantile surface, predicts
across every grid cell, and writes the result back to ``grid_prediction``. The
Spring Boot service then serves those rows. Python never enters the request
path.

This replaces the earlier hardcoded two-row DataFrame, which exercised the
model code but left the pipeline disconnected at both ends.

Usage:
    python run_nowcast.py --dry-run
    python run_nowcast.py
"""

from __future__ import annotations

import argparse
from datetime import UTC, datetime

import numpy as np
import pandas as pd

from vaayu_ml.db import (
    EmptyTrainingSetError,
    load_cell_station_distance,
    load_feature_frame,
    load_grid_cells,
    load_station_cell_map,
    load_station_readings,
    record_model_run,
    write_grid_predictions,
)
from vaayu_ml.evaluation.exceedance import exceedance_metrics
from vaayu_ml.evaluation.loso_cv import loso_splits
from vaayu_ml.features.grid import add_cyclic_features
from vaayu_ml.features.wind import wind_direction_from, wind_speed
from vaayu_ml.models.nowcast_xgb import NowcastModel

MODEL_NAME = "nowcast_xgb"
ARTIFACT_DIR = "artifacts/nowcast"

# A station further than this from the nearest cell centroid is outside the
# pilot area rather than merely near its edge.
MAX_STATION_DISTANCE_KM = 15.0

# How stale a satellite retrieval may be and still describe a station reading.
# MODIS overpasses once or twice a day, so anything under a day is normal; past
# that the aerosol column has had time to change and the pairing is noise.
SNAPSHOT_TOLERANCE_HOURS = 24


def model_version() -> str:
    return f"{MODEL_NAME}-{datetime.now(UTC):%Y%m%dT%H%M%S}"


def derive_wind(frame: pd.DataFrame) -> pd.DataFrame:
    """Convert wind vectors to speed and meteorological direction.

    Direction is the bearing the wind blows *from*, which is the convention
    every meteorological source and every domain reader expects.
    """
    frame = frame.copy()
    u = frame.get("wind_u")
    v = frame.get("wind_v")

    if u is None or v is None:
        frame["wind_speed"] = np.nan
        frame["wind_direction"] = np.nan
        return frame

    frame["wind_speed"] = wind_speed(u, v)
    frame["wind_direction"] = wind_direction_from(u, v)
    return frame


def assemble(hours: int) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Build the prediction frame and the labelled training subset."""
    cells = load_grid_cells()
    features = load_feature_frame(hours=hours)

    if features.empty:
        raise EmptyTrainingSetError(
            "No satellite or meteorological snapshots in the window. "
            "Run the ingestion jobs before the nowcast."
        )

    frame = features.merge(cells, on="grid_cell_id", how="left")
    # Needed for prediction as well as training: the model must know how far
    # each cell sits from ground truth.
    frame = frame.merge(load_cell_station_distance(), on="grid_cell_id", how="left")
    frame = derive_wind(frame)
    frame = add_cyclic_features(frame)

    # Real satellite coverage from the database, not a count of non-null
    # columns. A cell seen across a third of its area carries a value, so
    # column presence would report full coverage for a mostly unseen cell.
    frame["coverage_fraction"] = frame["aod_coverage_fraction"].fillna(0.0)

    readings = load_station_readings(hours=hours)
    station_cells = load_station_cell_map()

    if readings.empty or station_cells.empty:
        return frame, pd.DataFrame()

    station_cells = station_cells[station_cells["distance_km"] <= MAX_STATION_DISTANCE_KM]
    labelled = readings.merge(station_cells, on="station_id", how="inner")

    # Join each reading to the most recent snapshot for its cell, not to a
    # snapshot at the same hour.
    #
    # Station readings are hourly; MODIS overpasses once or twice a day and
    # Sentinel-5P daily. Hourly AOD does not exist, so an equality join on the
    # hour matches almost nothing and quietly yields an empty training set. An
    # as-of join is what the physical sampling actually supports.
    labelled["hour"] = pd.to_datetime(labelled["ts"]).dt.floor("h")
    frame["hour"] = pd.to_datetime(frame["ts"]).dt.floor("h")

    training = pd.merge_asof(
        labelled.sort_values("hour"),
        frame.drop(columns=["ts"]).sort_values("hour"),
        on="hour",
        by="grid_cell_id",
        direction="nearest",
        tolerance=pd.Timedelta(hours=SNAPSHOT_TOLERANCE_HOURS),
    )
    # merge_asof keeps unmatched left rows with null right columns, so unmatched
    # readings must be dropped explicitly.
    #
    # This previously tested only `blh`, which comes from met_snapshot, while the
    # comment claimed it excluded rows with no satellite retrieval. Those are
    # different tables: a row could have meteorology and no AOD at all and still
    # pass. Combined with the timestamp misalignment between the ingestion jobs,
    # that meant every training row had null satellite features and the model
    # still reported a plausible RMSE -- trained on meteorology alone while
    # appearing to use satellite data.
    #
    # Requiring the satellite column too makes the guard mean what it says. AOD
    # is the feature the nowcast exists to exploit; without it this is a
    # meteorology regression wearing a satellite model's name.
    required = ["blh", "aod_047"]
    before = len(training)
    training = training.dropna(subset=required)
    dropped = before - len(training)
    if dropped:
        print(f"  dropped {dropped} of {before} rows lacking {required}")
    # Overwrite the merged cell-level value with the distance to the station
    # this row is actually labelled by.
    training["distance_to_nearest_station_km"] = training["distance_km"]

    return frame, training


def evaluate(model: NowcastModel, training: pd.DataFrame) -> dict:
    """Score the model, reporting leave-one-station-out alongside in-sample.

    LOSO is the honest number: it forces the model to predict a station it has
    never seen. It is always lower than the in-sample score, and both are
    reported so the gap is visible rather than chosen.
    """
    metrics: dict[str, float | int | str] = {"n_train": int(len(training))}

    predictions = model.predict(training)["pm25_q50"]
    actual = training["pm25"].to_numpy()
    metrics["rmse_in_sample"] = float(np.sqrt(np.mean((actual - predictions) ** 2)))

    station_ids = training["station_id"].to_numpy()
    if len(np.unique(station_ids)) < 2:
        metrics["loso"] = "unavailable: fewer than two stations in the training set"
        return metrics

    errors, held_actual, held_predicted = [], [], []
    for train_idx, test_idx in loso_splits(station_ids):
        fold = NowcastModel(**model.params)
        fold.train(training.iloc[train_idx], mlflow_run_name="nowcast_loso_fold")
        fold_pred = fold.predict(training.iloc[test_idx])["pm25_q50"].to_numpy()
        fold_actual = training.iloc[test_idx]["pm25"].to_numpy()

        errors.append(np.sqrt(np.mean((fold_actual - fold_pred) ** 2)))
        held_actual.extend(fold_actual)
        held_predicted.extend(fold_pred)

    metrics["rmse_loso"] = float(np.mean(errors))
    metrics["n_stations"] = int(len(np.unique(station_ids)))
    metrics.update(
        {
            f"exceedance_{key}": value
            for key, value in exceedance_metrics(
                np.array(held_actual), np.array(held_predicted), threshold=300.0
            ).items()
        }
    )
    return metrics


def run(hours: int = 720, dry_run: bool = False) -> None:
    version = model_version()
    print(f"model_version={version}")

    frame, training = assemble(hours)
    print(f"cells={frame['grid_cell_id'].nunique()} feature_rows={len(frame)}")
    print(f"labelled training rows={len(training)}")

    if training.empty:
        raise EmptyTrainingSetError(
            "No station reading aligned to a grid cell and an hourly snapshot. "
            "Training on an empty frame yields a constant predictor that still "
            "reports a score, so this stops instead."
        )

    model = NowcastModel()
    model.train(training)

    metrics = evaluate(model, training)
    for key, value in metrics.items():
        print(f"  {key}: {value}")

    # Predict only the most recent snapshot. Scoring the whole lookback window
    # wrote a prediction for every historical hour on every run, and because each
    # run stamps a fresh model_version the ON CONFLICT upsert never fired, so
    # grid_prediction grew without bound. The nowcast is a current-conditions
    # surface; back-filling history is a separate job with different semantics.
    latest_ts = frame["ts"].max()
    frame = frame[frame["ts"] == latest_ts].reset_index(drop=True)
    print(f"  predicting {len(frame)} cells at {latest_ts}")

    predictions = model.predict(frame)
    output = pd.DataFrame(
        {
            "grid_cell_id": frame["grid_cell_id"].to_numpy(),
            "ts": frame["ts"].to_numpy(),
            "pm25_q10": predictions["pm25_q10"].to_numpy(),
            "pm25_q50": predictions["pm25_q50"].to_numpy(),
            "pm25_q90": predictions["pm25_q90"].to_numpy(),
            # The database value, not the model's column-presence estimate.
            "coverage_fraction": frame["coverage_fraction"].to_numpy(),
        }
    )

    if dry_run:
        print(f"\ndry run: would write {len(output)} predictions")
        print(output.head(3).to_string(index=False))
        return

    model.save(ARTIFACT_DIR)
    written = write_grid_predictions(output, version, source="MODEL")
    record_model_run(
        MODEL_NAME,
        version,
        metrics,
        notes=(
            "Trained on grid covariates tagged APPROXIMATED; population, "
            "elevation, road density and built-up fraction are distance-derived "
            "stand-ins rather than WorldPop, SRTM and OSM joins."
        ),
    )
    print(f"\nwritten={written} artifacts={ARTIFACT_DIR}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the nowcast pipeline")
    parser.add_argument("--hours", type=int, default=720)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    run(hours=args.hours, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
