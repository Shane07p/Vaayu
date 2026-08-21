import numpy as np
import pandas as pd

def add_cyclic_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add sin/cos transformations for diurnal and seasonal cycles."""
    if "ts" not in df.columns:
        raise ValueError("DataFrame must contain a 'ts' datetime column")
    
    # Ensure ts is a datetime accessor
    ts = pd.to_datetime(df["ts"])
    
    df["doy_sin"] = np.sin(2 * np.pi * ts.dt.dayofyear / 365.25)
    df["doy_cos"] = np.cos(2 * np.pi * ts.dt.dayofyear / 365.25)
    df["hour_sin"] = np.sin(2 * np.pi * ts.dt.hour / 24.0)
    df["hour_cos"] = np.cos(2 * np.pi * ts.dt.hour / 24.0)
    
    return df

def build_static_features(grid_cells: pd.DataFrame) -> pd.DataFrame:
    """
    Append static geographical features to grid cells.
    In a full production system, these would be spatial joins against 
    OpenStreetMap and SRTM DEM rasters. For this hackathon/pilot, 
    we use baseline urban/peri-urban approximations.
    """
    df = grid_cells.copy()
    
    # Mocking static geography based on proximity to Delhi center
    # Center of Delhi-NCR roughly 28.61, 77.23
    delhi_lat, delhi_lon = 28.6139, 77.2090
    
    if "centroid_lat" in df.columns and "centroid_lon" in df.columns:
        # Distance from center in degrees (approximate)
        dist = np.sqrt((df["centroid_lat"] - delhi_lat)**2 + (df["centroid_lon"] - delhi_lon)**2)
        
        # Elevation: Delhi is ~200m-250m. Slight rise towards south (Aravalli)
        df["elevation_m"] = 215.0 + (df["centroid_lat"] < 28.5).astype(float) * 30.0
        
        # Road density: drops off as you move away from the center
        df["road_density_km_per_km2"] = np.where(dist < 0.2, 8.5, np.where(dist < 0.4, 5.0, 2.5))
        
        # Built-up fraction
        df["built_up_fraction"] = np.where(dist < 0.2, 0.85, np.where(dist < 0.4, 0.55, 0.30))
    else:
        # Fallbacks if coordinates are missing
        df["elevation_m"] = 215.0
        df["road_density_km_per_km2"] = 5.0
        df["built_up_fraction"] = 0.5
        
    return df
