from __future__ import annotations

import math

import pandas as pd


def impact_score(
    total_frp: float,
    downwind_population: int,
    transport_hours: float,
    trajectory_confidence: float,
    decay_hours: float = 12.0,
) -> float:
    """Score a single fire cluster by its predicted impact on a downwind receptor.

    The formula encodes three physical intuitions:
    - Higher fire radiative power means more smoke emitted.
    - Larger exposed population amplifies public-health harm.
    - Longer transport time attenuates concentration via dilution and deposition.
    - Trajectory confidence scales the estimate: a weakly-supported path is worth less.

    Args:
        total_frp: Aggregate fire radiative power of the cluster (MW or W/m2).
        downwind_population: Estimated people in the receptor footprint.
        transport_hours: Estimated travel time from the cluster to the receptor.
        trajectory_confidence: Back-trajectory reliability in [0, 1].
        decay_hours: Exponential transport-decay time constant.

    Returns:
        A non-negative float. Higher is more dangerous.
    """
    if total_frp < 0:
        raise ValueError("total_frp must be non-negative")
    if downwind_population < 0:
        raise ValueError("downwind_population must be non-negative")
    if trajectory_confidence < 0 or trajectory_confidence > 1:
        raise ValueError("trajectory_confidence must be in [0, 1]")
    decay = math.exp(-transport_hours / decay_hours)
    return total_frp * math.log1p(downwind_population) * decay * trajectory_confidence


def rank_fire_clusters(
    clusters: pd.DataFrame,
    trajectories: dict,
    population_grid: pd.DataFrame | None,
    receptor: str = "DELHI-NCR",
) -> pd.DataFrame:
    """Rank fire clusters by their potential impact on a downwind receptor.

    Args:
        clusters: DataFrame with [id, code, lat, lon, total_frp, detection_count]
        trajectories: dict mapping receptor string to list of (lat, lon) tuples
        population_grid: DataFrame with grid cell populations, or None
        receptor: Name of the receptor

    Returns:
        DataFrame sorted by impact_rank ASC.
    """
    if clusters is None or len(clusters) == 0:
        return pd.DataFrame()

    df = clusters.copy()

    # Compute haversine inline to avoid circular import with align
    def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        r_earth = 6371.0
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        d_phi = math.radians(lat2 - lat1)
        d_lam = math.radians(lon2 - lon1)
        a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lam / 2) ** 2
        return r_earth * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    waypoints = trajectories.get(receptor, [])
    pop = population_grid["population"].sum() if population_grid is not None else 18_400_000

    scores = []
    transport_hrs = []
    intersections = []

    for _, cluster in df.iterrows():
        c_lat, c_lon = float(cluster["lat"]), float(cluster["lon"])

        if waypoints:
            min_dist = float("inf")
            t_hours = 0
            for h, (w_lat, w_lon) in enumerate(waypoints):
                dist = _haversine(c_lat, c_lon, float(w_lat), float(w_lon))
                if dist < min_dist:
                    min_dist = dist
                    t_hours = h
            intersection = 1.0 if min_dist <= 50.0 else 0.0
        else:
            # No trajectory available — fall back to distance from Delhi
            delhi_lat, delhi_lon = 28.6139, 77.2090
            dist = _haversine(c_lat, c_lon, delhi_lat, delhi_lon)
            t_hours = dist / 10.0
            intersection = 0.0

        conf = float(cluster.get("trajectory_confidence", 0.81))
        score = impact_score(float(cluster["total_frp"]), int(pop), t_hours, conf)

        scores.append(score)
        transport_hrs.append(t_hours)
        intersections.append(intersection)

    df["impact_score"] = scores
    df["trajectory_intersection"] = intersections
    df["transport_hours"] = transport_hrs
    df["trajectory_confidence"] = [
        float(c.get("trajectory_confidence", 0.81)) for _, c in df.iterrows()
    ]
    df["downwind_population"] = int(pop)

    df = df.sort_values("impact_score", ascending=False).reset_index(drop=True)
    df["impact_rank"] = df.index + 1
    df["consecutive_days_unactioned"] = 0
    df["direction_95_eligible"] = False

    return df
