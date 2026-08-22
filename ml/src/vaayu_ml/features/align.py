import numpy as np
import pandas as pd


def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate the great circle distance in kilometers between two points."""
    r_earth = 6371.0  # Earth radius in km

    phi1 = np.radians(lat1)
    phi2 = np.radians(lat2)
    delta_phi = np.radians(lat2 - lat1)
    delta_lambda = np.radians(lon2 - lon1)

    a = np.sin(delta_phi / 2.0) ** 2 + np.cos(phi1) * np.cos(phi2) * np.sin(delta_lambda / 2.0) ** 2
    c = 2 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))

    return r_earth * c


def build_aligned_dataset(
    station_readings: pd.DataFrame,
    grid_cells: pd.DataFrame,
    gee_aod: pd.DataFrame,
    gee_s5p: pd.DataFrame,
    met: pd.DataFrame,
) -> pd.DataFrame:
    """
    Spatiotemporal join of sparse station readings with dense satellite/met rasters.

    Args:
        station_readings: cols [station_id, lat, lon, ts, pm25]
        grid_cells: cols [grid_cell_code, centroid_lat, centroid_lon]
        gee_aod: cols [grid_cell_code, ts, aod_047, aod_055, aod_uncert...]
        gee_s5p: cols [grid_cell_code, ts, no2_column, aer_ai]
        met: cols [grid_cell_code, ts, blh, wind_u, wind_v, rh, temp_2m]
    """
    df = station_readings.copy()
    df["ts"] = pd.to_datetime(df["ts"])
    df["date"] = df["ts"].dt.date

    # 1. Spatial join: Snap each station to the nearest grid cell
    # In a real pipeline with thousands of points use KDTree. Distance matrix is fine here.
    station_coords = df[["station_id", "lat", "lon"]].drop_duplicates()

    nearest_cells = []
    distances = []

    for _, row in station_coords.iterrows():
        dists = haversine_distance(
            row["lat"],
            row["lon"],
            grid_cells["centroid_lat"].values,
            grid_cells["centroid_lon"].values,
        )
        min_idx = np.argmin(dists)
        nearest_cells.append(grid_cells.iloc[min_idx]["grid_cell_code"])
        distances.append(dists[min_idx])

    station_coords["grid_cell_code"] = nearest_cells
    station_coords["distance_to_nearest_station_km"] = distances

    # Join the grid cell mappings back to readings
    df = df.merge(
        station_coords[["station_id", "grid_cell_code", "distance_to_nearest_station_km"]],
        on="station_id",
    )

    # 2. Join ERA5 Met Data (Hourly - join on exact ts)
    met_copy = met.copy()
    met_copy["ts"] = pd.to_datetime(met_copy["ts"])

    df = df.merge(met_copy, on=["grid_cell_code", "ts"], how="left")

    # 3. Join GEE AOD and S5P (Daily - join on date)
    aod_copy = gee_aod.copy()
    aod_copy["ts"] = pd.to_datetime(aod_copy["ts"])
    aod_copy["date"] = aod_copy["ts"].dt.date
    aod_copy = aod_copy.drop(columns=["ts"])

    s5p_copy = gee_s5p.copy()
    s5p_copy["ts"] = pd.to_datetime(s5p_copy["ts"])
    s5p_copy["date"] = s5p_copy["ts"].dt.date
    s5p_copy = s5p_copy.drop(columns=["ts"])

    df = df.merge(aod_copy, on=["grid_cell_code", "date"], how="left")
    df = df.merge(s5p_copy, on=["grid_cell_code", "date"], how="left")

    # Wind vector to wind speed and direction
    if "wind_u" in df.columns and "wind_v" in df.columns:
        df["wind_speed"] = np.sqrt(df["wind_u"] ** 2 + df["wind_v"] ** 2)
        df["wind_direction"] = (np.degrees(np.arctan2(df["wind_u"], df["wind_v"])) + 360) % 360

    df = df.drop(columns=["date"])

    return df
