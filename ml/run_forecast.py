import pandas as pd
from vaayu_ml.models.forecast_lgbm import ForecastModel
from vaayu_ml.features.grid import add_cyclic_features

def run():
    print("Preparing forecast datasets...")
    # Mock aligned data
    df = pd.DataFrame({
        "ts": ["2026-08-21 12:00:00", "2026-08-21 12:00:00"],
        "station_id": [1, 2],
        "pm25": [150.0, 110.0],
        "aod_047": [0.5, 0.6], "aod_055": [0.4, 0.5], "blh": [500, 600], 
        "wind_speed": [2.5, 3.0], "wind_direction": [180, 190],
        "rh": [45, 50], "temp_2m": [300, 301],
        "elevation_m": [215, 245], "road_density_km_per_km2": [8.5, 5.0],
        "built_up_fraction": [0.85, 0.55],
        "pm25_lag_1h": [140, 100], "pm25_lag_3h": [130, 90], "pm25_lag_6h": [120, 80], 
        "pm25_lag_12h": [110, 70], "pm25_lag_24h": [100, 60],
        "pm25_rolling_mean_6h": [135, 95], "pm25_rolling_max_6h": [150, 110],
        "upwind_fire_exposure": [15.5, 2.1],
        "cams_pm25_6h": [145.0, 105.0]
    })
    df = add_cyclic_features(df)
    
    # Mock shifted targets for training
    df["pm25_target_6h"] = [160.0, 115.0]
    df["pm25_target_24h"] = [170.0, 125.0]
    df["pm25_target_72h"] = [120.0, 90.0]
    
    print("Running LightGBM Forecast...")
    model = ForecastModel(n_estimators=10)
    
    for h in [6, 24, 72]:
        print(f"Training {h}h horizon...")
        model.train(df, horizon=h)
        preds = model.predict(df, horizon=h)
        print(preds)
        
    print("Done! (In live mode, these write to `forecast` in PostGIS)")

if __name__ == "__main__":
    run()
