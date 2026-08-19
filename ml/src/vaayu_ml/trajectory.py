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

EARTH_RADIUS_M = 6_371_000.0
