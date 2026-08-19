"""Lagrangian back-trajectory over ERA5 and GFS wind fields.

Steps an air parcel backwards through the wind field from a receptor to recover
its path and transport time.

This is deliberately NOT HYSPLIT and must never be described as HYSPLIT in code,
comments, interfaces, or documentation. HYSPLIT requires a compiled binary and
multi-gigabyte GDAS meteorology files, which do not fit the deployment target.

What it is: a single-particle approximation, not dispersion modelling. That is
the same caveat the technical document already states for HYSPLIT trajectories,
so the honesty framing is unchanged. Attribution confidence is reported, never
asserted.

Implement: ``back_trajectory(lat, lon, wind_at, hours=48, step_hours=1)``
returning ``list[tuple[float, float]]``, receptor first and oldest last.
"""

from __future__ import annotations

import math

EARTH_RADIUS_M = 6_371_000.0


def back_trajectory(
    lat: float,
    lon: float,
    wind_at,
    hours: int = 48,
    step_hours: int = 1,
) -> list[tuple[float, float]]:
    """Integrate a single parcel backward using an east/north m/s wind callback.

    ``wind_at(latitude, longitude, elapsed_hours)`` returns ``(u, v)`` where
    positive values point east and north. Missing wind data stops the path: a
    fabricated continuation would look more certain than the inputs permit.
    """
    if not -90 <= lat <= 90 or not -180 <= lon <= 180:
        raise ValueError("starting latitude or longitude is invalid")
    if hours < 1 or step_hours < 1 or hours % step_hours:
        raise ValueError(
            "hours and step_hours must be positive, with hours divisible by step_hours"
        )

    path = [(float(lat), float(lon))]
    seconds = step_hours * 3_600
    for elapsed in range(0, hours, step_hours):
        wind = wind_at(lat, lon, elapsed)
        if wind is None:
            break
        try:
            u, v = wind
        except (TypeError, ValueError):
            break
        if not all(
            isinstance(component, (int, float)) and math.isfinite(component)
            for component in (u, v)
        ):
            break
        lat -= (v * seconds / EARTH_RADIUS_M) * 180 / 3.141592653589793
        cosine = math.cos(math.radians(lat))
        if abs(cosine) < 1e-8:
            break
        lon -= (u * seconds / (EARTH_RADIUS_M * cosine)) * 180 / 3.141592653589793
        lon = (lon + 180) % 360 - 180
        if not -90 <= lat <= 90:
            break
        path.append((lat, lon))
    return path
