"""Geodesic clustering for FIRMS fire detections."""

from __future__ import annotations

import numpy as np
from sklearn.cluster import DBSCAN

EARTH_RADIUS_KM = 6_371.0088


def cluster_fire_detections(
    coordinates: np.ndarray | list[tuple[float, float]],
    eps_km: float = 10.0,
    min_samples: int = 2,
) -> np.ndarray:
    """Cluster ``(latitude, longitude)`` detections using haversine distance.

    Noise points receive DBSCAN's ``-1`` label and are intentionally preserved:
    an isolated high-FRP fire may still matter to an enforcement worklist.
    """
    if eps_km <= 0:
        raise ValueError("eps_km must be positive")
    if min_samples < 1:
        raise ValueError("min_samples must be at least 1")
    points = np.asarray(coordinates, dtype=float)
    if points.ndim != 2 or points.shape[1] != 2:
        raise ValueError("coordinates must have shape (n, 2) as latitude, longitude")
    if not len(points):
        return np.empty(0, dtype=int)
    if (
        not np.isfinite(points).all()
        or np.any(np.abs(points[:, 0]) > 90)
        or np.any(np.abs(points[:, 1]) > 180)
    ):
        raise ValueError("coordinates contain an invalid latitude or longitude")
    return DBSCAN(
        eps=eps_km / EARTH_RADIUS_KM, min_samples=min_samples, metric="haversine"
    ).fit_predict(np.radians(points))
