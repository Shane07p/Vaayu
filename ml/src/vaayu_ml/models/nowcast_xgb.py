from pathlib import Path

import mlflow
import numpy as np
import pandas as pd
import xgboost as xgb


class NowcastModel:
    """XGBoost quantile regression for 1km PM2.5 surface."""
    
    QUANTILES = [0.1, 0.5, 0.9]
    FEATURE_COLS = [
        "aod_047", "aod_055", "aod_uncertainty", "column_wv",
        "no2_column", "aer_ai",
        "blh", "wind_speed", "wind_direction", "rh", "temp_2m",
        "elevation_m", "road_density_km_per_km2", "built_up_fraction",
        "distance_to_nearest_station_km",
        "doy_sin", "doy_cos", "hour_sin", "hour_cos",
    ]
    
    def __init__(self, n_estimators=100, max_depth=6, learning_rate=0.1):
        self.params = {
            "n_estimators": n_estimators,
            "max_depth": max_depth,
            "learning_rate": learning_rate
        }
        self.models = {}
        
    def train(self, df: pd.DataFrame, mlflow_run_name: str = "nowcast_xgb") -> None:
        """Train 3 quantile models, log metrics + artifacts to MLflow."""
        x_features = df[self.FEATURE_COLS]
        y = df["pm25"]
        
        mlflow.set_experiment("vaayu_nowcast")
        with mlflow.start_run(run_name=mlflow_run_name):
            mlflow.log_params(self.params)
            
            for q in self.QUANTILES:
                model = xgb.XGBRegressor(
                    objective="reg:quantileerror",
                    quantile_alpha=q,
                    **self.params
                )
                model.fit(x_features, y)
                self.models[q] = model
                
            # Log training metrics
            preds_50 = self.models[0.5].predict(x_features)
            rmse = np.sqrt(np.mean((y - preds_50)**2))
            r2 = 1 - np.sum((y - preds_50)**2) / np.sum((y - np.mean(y))**2)
            
            mlflow.log_metric("rmse_train", rmse)
            mlflow.log_metric("r2_train", r2)
            
    def predict(self, df: pd.DataFrame) -> pd.DataFrame:
        """Returns q10, q50, q90 columns + coverage_fraction."""
        x_features = df[self.FEATURE_COLS]
        
        preds = pd.DataFrame(index=df.index)
        if 0.1 in self.models:
            preds["pm25_q10"] = self.models[0.1].predict(x_features)
        if 0.5 in self.models:
            preds["pm25_q50"] = self.models[0.5].predict(x_features)
        if 0.9 in self.models:
            preds["pm25_q90"] = self.models[0.9].predict(x_features)
            
        # Calculate coverage fraction (fraction of satellite AOD features that are not NaN/missing)
        aod_cols = ["aod_047", "aod_055"]
        valid_aod = x_features[aod_cols].notna().mean(axis=1)
        preds["coverage_fraction"] = valid_aod
        
        return preds
        
    def save(self, artifact_path: str):
        """Save models to directory."""
        path = Path(artifact_path)
        path.mkdir(parents=True, exist_ok=True)
        for q, model in self.models.items():
            model.save_model(path / f"xgb_q{int(q*100)}.json")
            
    def load(self, artifact_path: str):
        """Load models from directory."""
        path = Path(artifact_path)
        for q in self.QUANTILES:
            model_file = path / f"xgb_q{int(q*100)}.json"
            if model_file.exists():
                model = xgb.XGBRegressor()
                model.load_model(model_file)
                self.models[q] = model
