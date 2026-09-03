"""Conservative, explainable PM2.5 sensor anomaly rules.

Delhi-NCR measurements do not reliably agree even within a few kilometres.
Neighbour disagreement alone is therefore not a fault signal. A neighbour rule
fires only for an extreme robust outlier with several contemporaneous peers;
the other rules catch an impossible unit-scale value and a frozen sensor.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from math import isfinite
from statistics import median
from typing import Literal

Reason = Literal["IMPOSSIBLE_CONCENTRATION", "STUCK_SENSOR", "NEIGHBOUR_OUTLIER"]

# 3,320 ug/m3 was previously a CO value read as PM2.5. This threshold is not an
# air-quality limit: it is a high, review-required unit-error tripwire.
IMPOSSIBLE_PM25_UG_M3 = 1_000.0
MIN_NEIGHBOURS = 3
MIN_NEIGHBOUR_GAP_UG_M3 = 150.0
MODIFIED_Z_THRESHOLD = 6.0
STUCK_OBSERVATIONS = 6


@dataclass(frozen=True)
class AnomalyCandidate:
    """A proposed holdout, with only facts used to make the decision."""

    reason: Reason
    details: dict[str, float | int | str]


def _mad(values: list[float], centre: float) -> float:
    return median([abs(value - centre) for value in values])


def detect_anomalies(
    value: float,
    neighbour_values: Iterable[float],
    recent_station_values: Iterable[float],
) -> list[AnomalyCandidate]:
    """Return independently auditable reasons to hold out one reading.

    Callers supply values aligned to the candidate's measurement time. The
    detector deliberately accepts ordinary Python collections so the same logic
    can be manually reviewed and unit tested without a database or ML runtime.
    """
    flags: list[AnomalyCandidate] = []
    if not isfinite(value) or value < 0:
        # Non-finite and negative values are refused at ingest before a row
        # exists. This branch protects historical/manual imports too.
        return [
            AnomalyCandidate(
                "IMPOSSIBLE_CONCENTRATION",
                {"pm25_ug_m3": str(value), "rule": "non-negative finite PM2.5 required"},
            )
        ]
    if value > IMPOSSIBLE_PM25_UG_M3:
        flags.append(
            AnomalyCandidate(
                "IMPOSSIBLE_CONCENTRATION",
                {"pm25_ug_m3": value, "threshold_ug_m3": IMPOSSIBLE_PM25_UG_M3},
            )
        )

    history = [float(item) for item in recent_station_values if isfinite(float(item))]
    if len(history) >= STUCK_OBSERVATIONS and len(set(history[-STUCK_OBSERVATIONS:])) == 1:
        flags.append(
            AnomalyCandidate(
                "STUCK_SENSOR",
                {
                    "pm25_ug_m3": value,
                    "identical_observations": STUCK_OBSERVATIONS,
                    "rule": "six consecutive reported values are identical",
                },
            )
        )

    neighbours = [float(item) for item in neighbour_values if isfinite(float(item))]
    if len(neighbours) >= MIN_NEIGHBOURS:
        centre = median(neighbours)
        mad = _mad(neighbours, centre)
        gap = abs(value - centre)
        # A zero MAD does not make every different reading anomalous. The large
        # absolute gap remains mandatory, reflecting the observed short-range
        # variation in PLAN §3.2.
        robust_scale = 1.4826 * mad
        modified_z = gap / robust_scale if robust_scale else float("inf")
        if gap >= MIN_NEIGHBOUR_GAP_UG_M3 and modified_z >= MODIFIED_Z_THRESHOLD:
            flags.append(
                AnomalyCandidate(
                    "NEIGHBOUR_OUTLIER",
                    {
                        "pm25_ug_m3": value,
                        "neighbour_count": len(neighbours),
                        "neighbour_median_ug_m3": centre,
                        "neighbour_mad_ug_m3": mad,
                        "absolute_gap_ug_m3": gap,
                        "modified_z": modified_z,
                    },
                )
            )
    return flags
