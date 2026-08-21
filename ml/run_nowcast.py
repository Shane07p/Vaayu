import pandas as pd

from vaayu_ml.features.grid import add_cyclic_features, build_static_features
from vaayu_ml.models.nowcast_xgb import NowcastModel


def run():
    print("Loading fixtures...")
    # Simulated loading of DB tables/fixtures
    # In a live system, this connects to PostGIS and pulls the last 24h
    grid_cells = pd.DataFrame({
        "grid_cell_code": ["GC-01", "GC-02"],
        "centroid_lat": [28.6, 28.5],
        "centroid_lon": [77.2, 77.1]
    })
    
    print("Building static and cyclic features...")
    grid_cells = build_static_features(grid_cells)
    
    # Mocking aligned dataset output for the models
    print("Running XGBoost Nowcast...")
    df = pd.DataFrame({
        "ts": ["2026-08-21 12:00:00", "2026-08-21 12:00:00"],
        "pm25": [150.0, 110.0],
        "aod_047": [0.5, 0.6], "aod_055": [0.4, 0.5],
        "aod_uncertainty": [0.1, 0.1], "column_wv": [2.1, 2.2],
        "no2_column": [0.0001, 0.0002], "aer_ai": [1.5, 1.6],
        "blh": [500, 600], "wind_speed": [2.5, 3.0], "wind_direction": [180, 190],
        "rh": [45, 50], "temp_2m": [300, 301],
        "elevation_m": [215, 245], "road_density_km_per_km2": [8.5, 5.0],
        "built_up_fraction": [0.85, 0.55],
        "distance_to_nearest_station_km": [2.1, 5.4],
    })
    df = add_cyclic_features(df)
    
    model = NowcastModel(n_estimators=10)
    model.train(df)
    preds = model.predict(df)
    
    print("Nowcast Predictions generated:")
    print(preds)
    print("Done! (In live mode, these write to `grid_prediction` in PostGIS)")

if __name__ == "__main__":
    run()
