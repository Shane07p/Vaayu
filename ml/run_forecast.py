"""Forecast pipeline: PostGIS in, PostGIS out.

The runner builds station-level training and inference rows from the stored
feature snapshots and station readings, trains the existing multi-horizon
LightGBM model, and persists only evaluable forecasts. In particular, a
missing current PM2.5 reading is never turned into a made-up persistence
baseline.
"""

from __future__ import annotations

import argparse
from datetime import UTC, datetime, timedelta

import numpy as np
import pandas as pd

from vaayu_ml.db import (
    EmptyTrainingSetError,
    load_feature_frame,
    load_fire_clusters,
    load_grid_cells,
    load_station_cell_map,
    load_station_readings,
    record_model_run,
    write_forecasts,
)
from vaayu_ml.features.grid import add_cyclic_features
from vaayu_ml.features.upwind_fire import upwind_fire_exposure
from vaayu_ml.models.forecast_lgbm import ForecastModel

MODEL_NAME = "forecast_lgbm"
MODEL_VERSION = "forecast-lgbm-v1"
SNAPSHOT_TOLERANCE_HOURS = 24


def derive_wind(frame: pd.DataFrame) -> pd.DataFrame:
    """Append wind speed and meteorological direction from stored vectors."""
    result = frame.copy()
    if "wind_u" not in result or "wind_v" not in result:
        result["wind_speed"] = np.nan
        result["wind_direction"] = np.nan
        return result

    result["wind_speed"] = np.hypot(result["wind_u"], result["wind_v"])
    result["wind_direction"] = (
        np.degrees(np.arctan2(-result["wind_u"], -result["wind_v"])) + 360.0
    ) % 360.0
    return result


def add_lag_features(frame: pd.DataFrame) -> pd.DataFrame:
    """Add the historical PM2.5 inputs expected by ``ForecastModel``."""
    result = frame.sort_values(["station_id", "ts"]).copy()
    grouped = result.groupby("station_id", sort=False)["pm25"]
    for lag in ForecastModel.LAG_HOURS:
        result[f"pm25_lag_{lag}h"] = grouped.shift(lag)
    result["pm25_rolling_mean_6h"] = grouped.transform(
        lambda values: values.rolling(6).mean()
    )
    result["pm25_rolling_max_6h"] = grouped.transform(
        lambda values: values.rolling(6).max()
    )
    return result


def add_fire_exposure(frame: pd.DataFrame, clusters: pd.DataFrame) -> pd.DataFrame:
    """Calculate the existing wind-aligned fire feature from stored clusters."""
    result = frame.copy()
    if clusters.empty:
        result["upwind_fire_exposure"] = 0.0
        return result

    fires = clusters.rename(columns={"total_frp": "frp"})
    required = {"lat", "lon", "frp"}
    missing = required - set(fires.columns)
    if missing:
        raise ValueError(f"fire clusters missing columns: {sorted(missing)}")

    result["upwind_fire_exposure"] = result.apply(
        lambda row: upwind_fire_exposure(
            float(row["centroid_lat"]),
            float(row["centroid_lon"]),
            fires,
            float(row["wind_u"]),
            float(row["wind_v"]),
        ),
        axis=1,
    )
    return result


def assemble(hours: int) -> pd.DataFrame:
    """Join stored hourly station PM2.5 to the nearest feature snapshot."""
    features = load_feature_frame(hours=hours)
    if features.empty:
        raise EmptyTrainingSetError(
            "No satellite or meteorological snapshots in the window. "
            "Run the ingestion jobs before the forecast."
        )

    readings = load_station_readings(hours=hours)
    if readings.empty:
        raise EmptyTrainingSetError(
            "No PM2.5 station readings in the window. A persistence baseline cannot be computed."
        )

    station_cells = load_station_cell_map()
    if station_cells.empty:
        raise EmptyTrainingSetError("No station-to-grid-cell mapping is available for forecasting.")

    cells = load_grid_cells()
    snapshots = features.merge(cells, on="grid_cell_id", how="inner")
    snapshots = add_cyclic_features(derive_wind(snapshots))

    observations = readings.merge(
        station_cells[["station_id", "grid_cell_id"]], on="station_id", how="inner"
    )
    observations["ts"] = pd.to_datetime(observations["ts"], utc=True, errors="coerce")
    snapshots["ts"] = pd.to_datetime(snapshots["ts"], utc=True, errors="coerce")
    observations = observations.dropna(subset=["ts", "pm25"])
    snapshots = snapshots.dropna(subset=["ts"])
    if observations.empty or snapshots.empty:
        raise EmptyTrainingSetError(
            "No timestamped station readings and feature snapshots can be aligned."
        )

    aligned = pd.merge_asof(
        observations.sort_values("ts"),
        snapshots.rename(columns={"ts": "feature_ts"}).sort_values("feature_ts"),
        left_on="ts",
        right_on="feature_ts",
        by="grid_cell_id",
        direction="nearest",
        tolerance=pd.Timedelta(hours=SNAPSHOT_TOLERANCE_HOURS),
    )
    aligned = aligned.dropna(subset=["feature_ts"])
    if aligned.empty:
        raise EmptyTrainingSetError(
            "No station reading has a feature snapshot within the allowed time tolerance."
        )

    return add_fire_exposure(add_lag_features(aligned), load_fire_clusters())


def forecast_output(
    model: ForecastModel, frame: pd.DataFrame, issued_at: datetime
) -> pd.DataFrame:
    """Produce schema-shaped rows for every model-supported horizon."""
    latest = frame.sort_values("ts").groupby("station_id", as_index=False).tail(1).copy()
    latest = latest.dropna(subset=ForecastModel.BASE_FEATURES + ["pm25"])
    if latest.empty:
        raise EmptyTrainingSetError(
            "No current station row contains every required forecast feature and "
            "persistence baseline."
        )

    outputs = []
    for horizon in ForecastModel.HORIZONS:
        prediction = model.predict(latest, horizon=horizon)
        output = prediction.copy()
        output["station_id"] = latest["station_id"].to_numpy()
        # Station forecasts use station_id as their sole forecast target, as
        # required by the forecast table's exactly-one-target constraint.
        output["grid_cell_id"] = pd.NA
        output["issued_at"] = issued_at
        output["horizon_hours"] = horizon
        output["valid_at"] = issued_at + timedelta(hours=horizon)
        outputs.append(output)

    return pd.concat(outputs, ignore_index=True)


def validate_output(frame: pd.DataFrame) -> None:
    """Reject invalid model output before it reaches the database writer."""
    required = {
        "station_id",
        "issued_at",
        "horizon_hours",
        "valid_at",
        "pm25",
        "aqi",
        "ci_low",
        "ci_high",
        "baseline_persistence",
    }
    missing = required - set(frame.columns)
    if missing:
        raise ValueError(f"forecast output missing columns: {sorted(missing)}")
    if frame["station_id"].isna().any() or frame["issued_at"].isna().any():
        raise ValueError("forecast output has a missing station identifier or timestamp")
    if not set(frame["horizon_hours"]).issubset(ForecastModel.HORIZONS):
        raise ValueError("forecast output contains an unsupported horizon")
    if frame["baseline_persistence"].isna().any():
        raise ValueError("forecast output has a null baseline_persistence")

    numeric_columns = ["pm25", "aqi", "ci_low", "ci_high", "baseline_persistence"]
    values = frame[numeric_columns].apply(pd.to_numeric, errors="coerce")
    if not np.isfinite(values.to_numpy(dtype=float)).all():
        raise ValueError("forecast output contains a non-finite value")
    if (values["pm25"] < 0).any() or (values["aqi"] < 0).any() or (
        values["aqi"] > 500
    ).any():
        raise ValueError("forecast output contains an invalid PM2.5 or AQI value")

    intervals = np.sort(values[["ci_low", "ci_high"]].to_numpy(dtype=float), axis=1)
    frame[["ci_low", "ci_high"]] = intervals


def run(hours: int = 720, dry_run: bool = False) -> None:
    """Train all forecast horizons and persist their current station forecasts."""
    frame = assemble(hours)
    print(f"training rows={len(frame)} stations={frame['station_id'].nunique()}")

    training = frame.dropna(subset=ForecastModel.BASE_FEATURES + ["pm25"]).copy()
    if training.empty:
        raise EmptyTrainingSetError(
            "No training row contains every feature required by ForecastModel."
        )

    model = ForecastModel()
    for horizon in ForecastModel.HORIZONS:
        model.train(training.copy(), horizon=horizon)

    issued_at = datetime.now(UTC)
    output = forecast_output(model, frame, issued_at)
    validate_output(output)

    if dry_run:
        print(f"dry run: would write {len(output)} forecasts")
        print(output.head(3).to_string(index=False))
        return

    written = write_forecasts(output, MODEL_VERSION, source="MODEL")
    record_model_run(
        MODEL_NAME,
        MODEL_VERSION,
        {"n_training_rows": int(len(training)), "n_forecasts": int(len(output))},
        notes="Multi-horizon station forecast with a required current-PM2.5 persistence baseline.",
    )
    print(f"written={written} model_version={MODEL_VERSION}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the forecast pipeline")
    parser.add_argument("--hours", type=int, default=720)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    run(hours=args.hours, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
