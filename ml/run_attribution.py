import pandas as pd
from vaayu_ml.attribution.rank import rank_fire_clusters

def run():
    print("Loading fire clusters and calculating trajectories...")
    
    # Mock fire clusters
    clusters = pd.DataFrame({
        "id": [1, 2],
        "code": ["HR-01", "PB-02"],
        "lat": [29.5, 30.2],
        "lon": [76.8, 75.9],
        "total_frp": [450.5, 1200.0],
        "detection_count": [5, 15]
    })
    
    # Mock trajectory hitting PB-02 but missing HR-01
    trajectories = {
        "DELHI-NCR": [
            (28.6, 77.2), (29.0, 76.9), (29.6, 76.4), (30.1, 75.8)  # passes near PB-02 (30.2, 75.9)
        ]
    }
    
    # Mock population grid
    pop_grid = pd.DataFrame({"grid_cell_code": ["GC-1"], "population": [18000000]})
    
    print("Ranking clusters by impact...")
    ranked = rank_fire_clusters(clusters, trajectories, pop_grid)
    
    print(ranked[["code", "impact_rank", "impact_score", "trajectory_intersection", "transport_hours"]])
    print("Done! (In live mode, these write to `fire_cluster_impact` in PostGIS)")

if __name__ == "__main__":
    run()
