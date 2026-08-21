import numpy as np
import pandas as pd
from vaayu_ml.features.align import haversine_distance

def rank_fire_clusters(
    clusters: pd.DataFrame,
    trajectories: dict,
    population_grid: pd.DataFrame,
    receptor: str = "DELHI-NCR",
) -> pd.DataFrame:
    """
    Rank fire clusters by their potential impact on a downwind receptor.
    
    Args:
        clusters: DataFrame with [id, code, lat, lon, total_frp, detection_count]
        trajectories: dict mapping receptor string to list of (lat, lon) tuples
        population_grid: DataFrame with grid cell populations
        receptor: Name of the receptor
        
    Returns:
        DataFrame sorted by impact_rank ASC.
    """
    if clusters is None or len(clusters) == 0:
        return pd.DataFrame()
        
    df = clusters.copy()
    
    # Get receptor trajectory waypoints
    waypoints = trajectories.get(receptor, [])
    if not waypoints:
        # Fallback if no trajectory: rank by FRP / distance
        # Assuming Delhi approx location if receptor is DELHI-NCR
        r_lat, r_lon = 28.6139, 77.2090
        dists = haversine_distance(r_lat, r_lon, df["lat"].values, df["lon"].values)
        df["impact_score"] = df["total_frp"] / (1 + dists)
        df["trajectory_intersection"] = 0.0
        df["transport_hours"] = dists / 10.0 # guess 10km/h
        df["trajectory_confidence"] = 0.0
        df["downwind_population"] = population_grid["population"].sum() if population_grid is not None else 18400000
    else:
        scores = []
        intersections = []
        transport_hrs = []
        
        for _, cluster in df.iterrows():
            c_lat, c_lon = cluster["lat"], cluster["lon"]
            
            # Find minimum distance from trajectory to cluster
            min_dist = float('inf')
            t_hours = 0
            
            for h, (w_lat, w_lon) in enumerate(waypoints):
                dist = haversine_distance(c_lat, c_lon, w_lat, w_lon)
                if dist < min_dist:
                    min_dist = dist
                    t_hours = h
            
            # Intersection threshold: 50km
            intersection = 1.0 if min_dist <= 50.0 else 0.0
            
            # Exponential decay based on transport time (12h constant)
            decay = np.exp(-t_hours / 12.0)
            
            # Downwind population: static approx for pilot receptor
            pop = population_grid["population"].sum() if population_grid is not None else 18400000
            
            # Final score
            score = cluster["total_frp"] * intersection * decay * np.log1p(pop)
            
            scores.append(score)
            intersections.append(intersection)
            transport_hrs.append(t_hours)
            
        df["impact_score"] = scores
        df["trajectory_intersection"] = intersections
        df["transport_hours"] = transport_hrs
        df["trajectory_confidence"] = 0.81 # Default confidence for ERA5
        df["downwind_population"] = population_grid["population"].sum() if population_grid is not None else 18400000
        
    # Rank descending by score
    df = df.sort_values("impact_score", ascending=False).reset_index(drop=True)
    df["impact_rank"] = df.index + 1
    
    # Initialize unactioned logic
    df["consecutive_days_unactioned"] = 0
    df["direction_95_eligible"] = False
    
    return df
