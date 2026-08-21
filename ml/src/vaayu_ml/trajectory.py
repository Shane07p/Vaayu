"""Lagrangian back-trajectory approximation.

This is a single-particle approximation — no diffusion, no chemistry, no
vertical mixing. Accuracy degrades beyond ~48 h and in complex terrain.
See docs/TECHNICAL.md section 12 for the stated limitations.

The wind field is supplied as a callable so callers can inject ERA5 arrays,
test fixtures, or constant fields without this module needing to know about
the data format.
"""

from __future__ import annotations

from collections.abc import Callable


def back_trajectory(
    receptor_lat: float,
    receptor_lon: float,
    wind_fn: Callable[[float, float], tuple[float, float] | None],
    hours: int,
) -> list[tuple[float, float]]:
    """Trace a Lagrangian back-trajectory by stepping backward one hour at a time.

    Args:
        receptor_lat: Starting latitude (decimal degrees).
        receptor_lon: Starting longitude (decimal degrees).
        wind_fn: Callable(lat, lon) -> (u, v) in m/s, or None for missing data.
                 The trajectory stops as soon as wind_fn returns None.
        hours: Number of hours to trace back. The returned path has at most
               hours + 1 waypoints (including the receptor itself).

    Returns:
        List of (lat, lon) waypoints from t=0 (receptor) back to t=-hours.
        If wind_fn returns None on the first step, the list contains only the
        receptor itself.
    """
    waypoints: list[tuple[float, float]] = [(receptor_lat, receptor_lon)]
    cur_lat = receptor_lat
    cur_lon = receptor_lon

    for _ in range(hours):
        wind = wind_fn(cur_lat, cur_lon)
        if wind is None:
            break

        u_ms, v_ms = wind

        # Convert m/s to degrees per hour.
        # 1 degree of latitude  ≈ 111 km
        # 1 degree of longitude ≈ 111 km × cos(lat)
        import math

        u_kmh = u_ms * 3.6
        v_kmh = v_ms * 3.6
        d_lat = v_kmh / 111.0
        d_lon = u_kmh / (111.0 * math.cos(math.radians(cur_lat)))

        # Step *backward* in time — subtract the wind displacement
        cur_lat -= d_lat
        cur_lon -= d_lon
        waypoints.append((float(cur_lat), float(cur_lon)))

    return waypoints
