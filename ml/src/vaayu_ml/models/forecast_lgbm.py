from pathlib import Path

import lightgbm as lgb
import mlflow
import numpy as np
import pandas as pd


class ForecastModel:
    """LightGBM multi-horizon PM2.5 spike forecast."""

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

    def __init__(self, n_estimators=100, learning_rate=0.1):
        self.params = {
            "n_estimators": n_estimators,
            "learning_rate": learning_rate,
            "objective": "regression",
        }
        self.models = {}

    def train(self, df: pd.DataFrame, horizon: int, mlflow_run_name: str = "forecast_lgbm") -> None:
        """One model per horizon."""
        if horizon not in self.HORIZONS:
            raise ValueError(f"Horizon must be one of {self.HORIZONS}")

        # Target needs to be shifted by horizon
        target_col = f"pm25_target_{horizon}h"
        if target_col not in df.columns:
            # Shift backwards for training (future value becomes current row target)
            df[target_col] = df.groupby("station_id")["pm25"].shift(-horizon)

        train_df = df.dropna(subset=[target_col] + self.BASE_FEATURES)

        x_features = train_df[self.BASE_FEATURES]
        y = train_df[target_col]

        mlflow.set_experiment("vaayu_forecast")
        with mlflow.start_run(run_name=f"{mlflow_run_name}_{horizon}h"):
            mlflow.log_params(self.params)
            mlflow.log_param("horizon_hours", horizon)

            # Use quantile objective for prediction intervals
            # Model 50% (Median)
            model_50 = lgb.LGBMRegressor(objective="quantile", alpha=0.5, **self.params)
            model_50.fit(x_features, y)

            # Model 10% (Lower bound)
            model_10 = lgb.LGBMRegressor(objective="quantile", alpha=0.1, **self.params)
            model_10.fit(x_features, y)

            # Model 90% (Upper bound)
            model_90 = lgb.LGBMRegressor(objective="quantile", alpha=0.9, **self.params)
            model_90.fit(x_features, y)

            self.models[horizon] = {"q50": model_50, "q10": model_10, "q90": model_90}

            # Train metrics
            preds = model_50.predict(x_features)
            rmse = np.sqrt(np.mean((y - preds) ** 2))
            mlflow.log_metric("rmse_train", rmse)

    def pm25_to_aqi(self, pm25: float) -> int:
        """Convert PM2.5 (ug/m3) to India CPCB AQI."""
        breakpoints = [
            (0, 30, 0, 50),
            (31, 60, 51, 100),
            (61, 90, 101, 200),
            (91, 120, 201, 300),
            (121, 250, 301, 400),
            (251, 99999, 401, 500),
        ]
        pm25 = max(0, pm25)
        for c_low, c_high, i_low, i_high in breakpoints:
            if c_low <= pm25 <= c_high:
                return int(((i_high - i_low) / (c_high - c_low)) * (pm25 - c_low) + i_low)
        return 500  # Severe+

    def predict(self, df: pd.DataFrame, horizon: int) -> pd.DataFrame:
        """Returns pm25, aqi, ci_low, ci_high, baseline_persistence, baseline_cams."""
        if horizon not in self.models:
            raise ValueError(f"Model for horizon {horizon} not trained")

        x_features = df[self.BASE_FEATURES]

        preds = pd.DataFrame(index=df.index)
        preds["pm25"] = self.models[horizon]["q50"].predict(x_features)
        preds["ci_low"] = self.models[horizon]["q10"].predict(x_features)
        preds["ci_high"] = self.models[horizon]["q90"].predict(x_features)

        preds["aqi"] = preds["pm25"].apply(self.pm25_to_aqi)

        # Baselines
        preds["baseline_persistence"] = df.get("pm25", np.nan)
        preds["baseline_cams"] = df.get(f"cams_pm25_{horizon}h", np.nan)

        return preds

    def save(self, artifact_path: str):
        path = Path(artifact_path)
        path.mkdir(parents=True, exist_ok=True)
        for h, model_dict in self.models.items():
            for q, model in model_dict.items():
                model.booster_.save_model(path / f"lgbm_h{h}_{q}.txt")
