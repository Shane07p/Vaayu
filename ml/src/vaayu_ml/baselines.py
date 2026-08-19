"""Baselines every model is reported against.

A model that does not beat persistence at its stated horizon is reported as not
beating persistence. Baselines are never hidden.

Implement:
    ``persistence_baseline(series, horizon=1)``  - t+h equals t. Deceptively
                                                   strong at 6 hours.
    ``climatology_baseline(series, period=24)``  - mean for this position in
                                                   the cycle.

The CAMS baseline comes from Open-Meteo via the ingestion package and lands in
``forecast.baseline_cams``.
"""

from __future__ import annotations

import numpy as np


def persistence_baseline(series: np.ndarray | list[float], horizon: int = 1) -> np.ndarray:
    """Return the persistence prediction aligned to each target observation.

    The first ``horizon`` values have no historical value to copy and are
    represented by ``NaN`` instead of an invented baseline.
    """
    if horizon < 1:
        raise ValueError("horizon must be at least 1")

    values = np.asarray(series, dtype=float)
    if values.ndim != 1:
        raise ValueError("series must be one-dimensional")

    result = np.full(values.shape, np.nan, dtype=float)
    if horizon < len(values):
        result[horizon:] = values[:-horizon]
    return result


def climatology_baseline(series: np.ndarray | list[float], period: int = 24) -> np.ndarray:
    """Return a position-in-cycle climatology without leaking future values.

    A value is the mean of *earlier* observations at the same cycle position.
    This makes it suitable for chronological evaluation, unlike a whole-series
    group mean that would accidentally include the test period.
    """
    if period < 1:
        raise ValueError("period must be at least 1")

    values = np.asarray(series, dtype=float)
    if values.ndim != 1:
        raise ValueError("series must be one-dimensional")

    totals = np.zeros(period, dtype=float)
    counts = np.zeros(period, dtype=int)
    result = np.full(values.shape, np.nan, dtype=float)
    for index, value in enumerate(values):
        slot = index % period
        if counts[slot]:
            result[index] = totals[slot] / counts[slot]
        if not np.isnan(value):
            totals[slot] += value
            counts[slot] += 1
    return result
