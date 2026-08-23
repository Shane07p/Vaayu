"""Wind vector to speed and direction.

One implementation, deliberately.

``align.build_aligned_dataset`` and ``run_nowcast.derive_wind`` each had their
own version of this, and they disagreed by exactly 180 degrees: one computed the
direction the wind blows toward, the other the direction it blows from. Both
wrote the same ``wind_direction`` model feature, so whichever ran last decided
the convention and nothing anywhere said which was intended.

The convention here is meteorological: **the direction the wind comes FROM**,
measured clockwise from north. That is the standard for reported wind, and it is
the one attribution needs, because the question attribution asks is where the
smoke came from. A 180 degree error points every back-trajectory the wrong way
and would blame the wrong districts.
"""

from __future__ import annotations

import numpy as np

FULL_CIRCLE_DEGREES = 360.0


def wind_speed(u, v):
    """Scalar wind speed from the u and v components."""
    return np.hypot(u, v)


def wind_direction_from(u, v):
    """Direction the wind blows FROM, in degrees clockwise from north.

    Args:
        u: eastward component, positive toward the east.
        v: northward component, positive toward the north.

    Returns:
        Degrees in [0, 360). A wind blowing toward the south (``v`` negative)
        is a northerly and returns 0; one blowing toward the east (``u``
        positive) is a westerly and returns 270.
    """
    return (np.degrees(np.arctan2(-u, -v)) + FULL_CIRCLE_DEGREES) % FULL_CIRCLE_DEGREES
