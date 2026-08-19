"""Prediction-interval calibration.

A 90 percent interval must contain the truth about 90 percent of the time. An
interval that does not is a confidence claim the model has not earned.

Implement ``interval_coverage(y_true, lower, upper) -> dict`` and a reliability
diagram over the quantile predictions in ``grid_prediction``.
"""

from __future__ import annotations

import numpy as np


def interval_coverage(
    y_true: np.ndarray | list[float],
    lower: np.ndarray | list[float],
    upper: np.ndarray | list[float],
) -> dict[str, float | int]:
    """Measure empirical coverage and mean interval width for prediction bands."""
    observed = np.asarray(y_true, dtype=float)
    lows = np.asarray(lower, dtype=float)
    highs = np.asarray(upper, dtype=float)
    if observed.shape != lows.shape or observed.shape != highs.shape or observed.ndim != 1:
        raise ValueError("all inputs must be one-dimensional arrays of equal shape")
    if np.any(lows > highs):
        raise ValueError("lower bounds must not exceed upper bounds")

    valid = np.isfinite(observed) & np.isfinite(lows) & np.isfinite(highs)
    count = int(valid.sum())
    if not count:
        return {"samples": 0, "coverage": 0.0, "mean_interval_width": 0.0}
    contained = (observed[valid] >= lows[valid]) & (observed[valid] <= highs[valid])
    return {
        "samples": count,
        "coverage": float(contained.mean()),
        "mean_interval_width": float((highs[valid] - lows[valid]).mean()),
    }
