import pandas as pd

from vaayu_ml.attribution.rank import rank_fire_clusters
from vaayu_ml.trajectory import back_trajectory


def run() -> None:
    print("Loading fire clusters...")
    clusters = pd.DataFrame({
        "id": [1, 2],
        "code": ["HR-01", "PB-02"],
        "lat": [29.5, 30.2],
        "lon": [76.8, 75.9],
        "total_frp": [450.5, 1200.0],
        "detection_count": [5, 15],
        "trajectory_confidence": [0.75, 0.90],
    })

    # Wind blowing from north-west toward Delhi — westerly flow
    def constant_wind(lat: float, lon: float):  # noqa: ANN202
        return (3.5, -1.0)  # u=3.5 m/s east, v=-1.0 m/s south

    receptor_lat, receptor_lon = 28.6139, 77.2090
    waypoints = back_trajectory(receptor_lat, receptor_lon, constant_wind, hours=48)

    trajectories = {"DELHI-NCR": waypoints}
    pop_grid = pd.DataFrame({"grid_cell_code": ["GC-1"], "population": [18_000_000]})

    print("Ranking clusters by impact...")
    ranked = rank_fire_clusters(clusters, trajectories, pop_grid)
    cols = ["code", "impact_rank", "impact_score", "trajectory_intersection", "transport_hours"]
    print(ranked[cols])
    print("Done! (In live mode, these write to `fire_cluster_impact` in PostGIS)")


if __name__ == "__main__":
    run()
