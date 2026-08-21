import numpy as np
import pandas as pd

def back_trajectory(
    receptor_lat: float,
    receptor_lon: float,
    n_hours: int,
    wind_u_grid: np.ndarray,
    wind_v_grid: np.ndarray,
    grid_lats: np.ndarray,
    grid_lons: np.ndarray,
) -> list[tuple[float, float]]:
    """
    Lagrangian back-trajectory approximation.
    
    This is a single-particle Lagrangian approximation, not a dispersion model.
    It steps backward one hour at a time, calculating wind displacement.
    Accuracy degrades significantly beyond ~48h and in complex terrain.
    
    Args:
        receptor_lat, receptor_lon: Starting point
        n_hours: Number of hours to trace back
        wind_u_grid: 3D numpy array of U wind component (time, lat, lon)
        wind_v_grid: 3D numpy array of V wind component (time, lat, lon)
        grid_lats: 1D array of latitudes corresponding to grid
        grid_lons: 1D array of longitudes corresponding to grid
        
    Returns:
        List of (lat, lon) waypoints.
    """
    waypoints = [(receptor_lat, receptor_lon)]
    
    cur_lat = receptor_lat
    cur_lon = receptor_lon
    
    # Simple nearest-neighbor interpolation for this approximation
    for t in range(min(n_hours, wind_u_grid.shape[0])):
        # Find nearest grid index
        lat_idx = np.abs(grid_lats - cur_lat).argmin()
        lon_idx = np.abs(grid_lons - cur_lon).argmin()
        
        u = wind_u_grid[t, lat_idx, lon_idx]
        v = wind_v_grid[t, lat_idx, lon_idx]
        
        if np.isnan(u) or np.isnan(v):
            break
            
        # Convert wind speed (m/s) to degrees per hour approx
        # 1 degree lat is ~111 km, 1 degree lon is ~111 * cos(lat) km
        # 1 m/s = 3.6 km/h
        u_kmh = u * 3.6
        v_kmh = v * 3.6
        
        d_lat = v_kmh / 111.0
        d_lon = u_kmh / (111.0 * np.cos(np.radians(cur_lat)))
        
        # Step backward in time (so we subtract wind displacement)
        cur_lat = cur_lat - d_lat
        cur_lon = cur_lon - d_lon
        
        waypoints.append((float(cur_lat), float(cur_lon)))
        
    return waypoints
