"""Transparent, bounded fire-cluster impact scoring."""

from __future__ import annotations

import math


def impact_score(
    fire_radiative_power: float,
    downwind_population: int,
    transport_hours: float,
    trajectory_confidence: float,
) -> float:
    """Return a 0-1 prioritisation score, not a causal attribution claim."""
    if fire_radiative_power < 0 or downwind_population < 0 or transport_hours < 0:
        raise ValueError("fire_radiative_power, population, and transport_hours must be non-negative")
    if not 0 <= trajectory_confidence <= 1:
        raise ValueError("trajectory_confidence must be between 0 and 1")
    intensity = 1 - math.exp(-fire_radiative_power / 500)
    population = 1 - math.exp(-downwind_population / 5_000_000)
    timeliness = math.exp(-transport_hours / 48)
    return round(intensity * population * timeliness * trajectory_confidence, 6)
