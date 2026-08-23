from __future__ import annotations

from datetime import UTC, datetime

import numpy as np
import pandas as pd
import pytest

import run_forecast
from vaayu_ml.db import EmptyTrainingSetError


def _pipeline_frames() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    timestamps = pd.date_range("2026-08-01", periods=100, freq="h", tz="UTC")
    features = pd.DataFrame(
        {
            "grid_cell_id": 10,
            "ts": timestamps,
            "aod_047": 0.4,
            "aod_055": 0.3,
            "blh": 500.0,
            "wind_u": 2.0,
            "wind_v": 1.0,
            "rh": 45.0,
            "temp_2m": 300.0,
        }
    )
    readings = pd.DataFrame(
        {"station_id": 1, "ts": timestamps, "pm25": np.arange(100, 200, dtype=float)}
    )
    cells = pd.DataFrame(
        {
            "grid_cell_id": [10],
            "centroid_lat": [28.6],
            "centroid_lon": [77.2],
            "elevation_m": [220.0],
            "road_density_km_per_km2": [5.0],
            "built_up_fraction": [0.7],
        }
    )
    station_cells = pd.DataFrame({"station_id": [1], "grid_cell_id": [10]})
    return features, readings, cells, station_cells


class _FakeForecastModel:
    HORIZONS = [6, 24, 72]
    LAG_HOURS = [1, 3, 6, 12, 24]
    BASE_FEATURES = [
        "aod_047",
        "aod_055",
        "blh",
        "wind_speed",
        "wind_direction",
        "rh",
        "temp_2m",
        "elevation_m",
        "road_density_km_per_km2",
        "built_up_fraction",
        "doy_sin",
        "doy_cos",
        "hour_sin",
        "hour_cos",
        "pm25_lag_1h",
        "pm25_lag_3h",
        "pm25_lag_6h",
        "pm25_lag_12h",
        "pm25_lag_24h",
        "pm25_rolling_mean_6h",
        "pm25_rolling_max_6h",
        "upwind_fire_exposure",
    ]
    trained_horizons: list[int] = []
    baseline_persistence: float | None = None

    def train(self, frame: pd.DataFrame, horizon: int) -> None:
        self.trained_horizons.append(horizon)

    def predict(self, frame: pd.DataFrame, horizon: int) -> pd.DataFrame:
        baseline = frame["pm25"].to_numpy(dtype=float)
        if self.baseline_persistence is not None:
            baseline = np.full(len(frame), self.baseline_persistence)
        return pd.DataFrame(
            {
                "pm25": np.full(len(frame), 175.0),
                "aqi": np.full(len(frame), 350),
                "ci_low": np.full(len(frame), 160.0),
                "ci_high": np.full(len(frame), 190.0),
                "baseline_persistence": baseline,
                "baseline_cams": np.full(len(frame), np.nan),
            }
        )


def _patch_data(monkeypatch: pytest.MonkeyPatch) -> None:
    features, readings, cells, station_cells = _pipeline_frames()
    monkeypatch.setattr(run_forecast, "load_feature_frame", lambda hours: features)
    monkeypatch.setattr(run_forecast, "load_station_readings", lambda hours: readings)
    monkeypatch.setattr(run_forecast, "load_grid_cells", lambda: cells)
    monkeypatch.setattr(run_forecast, "load_station_cell_map", lambda: station_cells)
    monkeypatch.setattr(run_forecast, "load_fire_clusters", lambda: pd.DataFrame())


def test_run_loads_database_frames_and_writes_all_horizons(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_data(monkeypatch)
    _FakeForecastModel.trained_horizons = []
    monkeypatch.setattr(run_forecast, "ForecastModel", _FakeForecastModel)
    writes: list[pd.DataFrame] = []
    monkeypatch.setattr(
        run_forecast,
        "write_forecasts",
        lambda frame, model_version, source: writes.append(frame.copy()) or len(frame),
    )
    monkeypatch.setattr(run_forecast, "record_model_run", lambda *args, **kwargs: None)

    run_forecast.run(hours=100)

    assert _FakeForecastModel.trained_horizons == [6, 24, 72]
    assert len(writes) == 1
    written = writes[0]
    assert set(written["horizon_hours"]) == {6, 24, 72}
    assert written["baseline_persistence"].notna().all()
    assert written["baseline_cams"].isna().all()
    assert written["grid_cell_id"].isna().all()


def test_run_rejects_missing_persistence_baseline(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_data(monkeypatch)
    _FakeForecastModel.baseline_persistence = np.nan
    monkeypatch.setattr(run_forecast, "ForecastModel", _FakeForecastModel)
    writer_called = False

    def _writer(*args: object, **kwargs: object) -> int:
        nonlocal writer_called
        writer_called = True
        return 0

    monkeypatch.setattr(run_forecast, "write_forecasts", _writer)

    with pytest.raises(ValueError, match="null baseline_persistence"):
        run_forecast.run(hours=100)

    assert not writer_called
    _FakeForecastModel.baseline_persistence = None


def test_run_handles_empty_feature_frame(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(run_forecast, "load_feature_frame", lambda hours: pd.DataFrame())

    with pytest.raises(EmptyTrainingSetError, match="No satellite or meteorological"):
        run_forecast.run()


def test_run_surfaces_model_and_writer_failures(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_data(monkeypatch)

    class FailingModel(_FakeForecastModel):
        def train(self, frame: pd.DataFrame, horizon: int) -> None:
            raise RuntimeError("training failed")

    monkeypatch.setattr(run_forecast, "ForecastModel", FailingModel)
    with pytest.raises(RuntimeError, match="training failed"):
        run_forecast.run(hours=100)

    monkeypatch.setattr(run_forecast, "ForecastModel", _FakeForecastModel)
    monkeypatch.setattr(
        run_forecast,
        "write_forecasts",
        lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("write failed")),
    )
    with pytest.raises(RuntimeError, match="write failed"):
        run_forecast.run(hours=100)


def test_forecast_output_preserves_valid_time_per_horizon() -> None:
    frame = pd.DataFrame(
        {
            "station_id": [1],
            "ts": [datetime(2026, 8, 1, tzinfo=UTC)],
            "pm25": [100.0],
            **{feature: [1.0] for feature in _FakeForecastModel.BASE_FEATURES},
        }
    )
    issued_at = datetime(2026, 8, 2, tzinfo=UTC)
    output = run_forecast.forecast_output(_FakeForecastModel(), frame, issued_at)

    assert output.groupby("horizon_hours")["valid_at"].first().to_dict() == {
        6: datetime(2026, 8, 2, 6, tzinfo=UTC),
        24: datetime(2026, 8, 3, tzinfo=UTC),
        72: datetime(2026, 8, 5, tzinfo=UTC),
    }
