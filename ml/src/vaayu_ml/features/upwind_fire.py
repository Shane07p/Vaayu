import numpy as np
import pandas as pd
from vaayu_ml.features.align import haversine_distance

def upwind_fire_exposure(
    receptor_lat: float,
    receptor_lon: float,
    fires: pd.DataFrame,
    wind_u: float,
    wind_v: float,
    decay_hours: float = 12.0,
) -> float:
    """
    Calculate wind-aligned smoke exposure from surrounding fire clusters.
    
    Args:
        receptor_lat, receptor_lon: Target location
        fires: DataFrame with columns ['lat', 'lon', 'frp']
        wind_u, wind_v: Wind vector at receptor (m/s)
        decay_hours: Exponential decay time constant for transport
        
    Returns:
        Scalar representing aggregate upwind fire exposure.
    """
    if fires is None or len(fires) == 0:
        return 0.0
        
    if np.isnan(wind_u) or np.isnan(wind_v) or (wind_u == 0 and wind_v == 0):
        # Without wind, we can't determine upwind. Apply distance-only baseline
        dists = haversine_distance(receptor_lat, receptor_lon, fires["lat"].values, fires["lon"].values)
        return float(np.sum(fires["frp"].values / (1 + dists)))
        
    wind_speed_ms = np.sqrt(wind_u**2 + wind_v**2)
    # Wind vector direction (where it's going)
    # Note: meteorology wind_u/wind_v usually denote where the wind is blowing towards
    
    # 1. Vector from receptor TO fire (to see if fire is upwind, wind should blow from fire to receptor)
    # But wait, we want wind going FROM fire TO receptor.
    # The vector FROM receptor TO fire is (fire_lon - receptor_lon, fire_lat - receptor_lat)
    # The wind vector is (wind_u, wind_v). If wind is blowing FROM the fire TO the receptor,
    # the wind vector should point in the OPPOSITE direction of the receptor-to-fire vector.
    
    lon_diff = fires["lon"].values - receptor_lon
    lat_diff = fires["lat"].values - receptor_lat
    
    # Convert approx to meters (very rough, fine for cosine similarity)
    x_dist = lon_diff * 111000 * np.cos(np.radians(receptor_lat))
    y_dist = lat_diff * 111000
    
    # Distance in km
    dists_km = haversine_distance(receptor_lat, receptor_lon, fires["lat"].values, fires["lon"].values)
    
    # Cosine similarity between wind vector and (receptor -> fire) vector
    # We want them to be OPPOSITE for the fire to be upwind.
    dot_product = (x_dist * wind_u) + (y_dist * wind_v)
    mag_dist = np.sqrt(x_dist**2 + y_dist**2)
    
    # Avoid div by zero
    mag_dist = np.where(mag_dist == 0, 1e-6, mag_dist)
    
    # Cos_theta is 1 if wind blows exactly TO the fire, -1 if wind blows exactly FROM the fire
    cos_theta = dot_product / (mag_dist * wind_speed_ms)
    
    # We want maximum alignment when cos_theta is -1 (wind blowing from fire to receptor)
    wind_alignment = np.maximum(0, -cos_theta)
    
    # Transport time in hours (distance / speed)
    # Convert wind speed m/s to km/h (* 3.6)
    wind_speed_kmh = max(wind_speed_ms * 3.6, 1.0) # minimum 1 km/h to avoid infinite time
    transport_hours = dists_km / wind_speed_kmh
    
    # Calculate contribution: FRP * alignment * decay
    contribution = fires["frp"].values * wind_alignment * np.exp(-transport_hours / decay_hours)
    
    return float(np.sum(contribution))
