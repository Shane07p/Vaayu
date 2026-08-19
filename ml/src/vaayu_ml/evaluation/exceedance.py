"""Spike-detection metrics.

RMSE is dominated by ordinary days. The product is about episodes, so
precision, recall, and F1 at the exceedance threshold are reported alongside it.

Implement ``exceedance_metrics(y_true, y_pred, threshold=300.0) -> dict``.

Return zero rather than NaN when a period contains no exceedances, or the
seasonal breakdown table silently breaks on clean seasons.
"""

from __future__ import annotations

import numpy as np


def exceedance_metrics(
    y_true: np.ndarray | list[float],
    y_pred: np.ndarray | list[float],
    threshold: float = 300.0,
) -> dict[str, float | int]:
    """Return deterministic event metrics for values at or above ``threshold``."""
    actual = np.asarray(y_true, dtype=float)
    predicted = np.asarray(y_pred, dtype=float)
    if actual.shape != predicted.shape or actual.ndim != 1:
        raise ValueError("y_true and y_pred must be one-dimensional arrays of equal shape")
    if not np.isfinite(threshold):
        raise ValueError("threshold must be finite")

    valid = np.isfinite(actual) & np.isfinite(predicted)
    observed_events = actual[valid] >= threshold
    predicted_events = predicted[valid] >= threshold
    true_positive = int(np.sum(observed_events & predicted_events))
    false_positive = int(np.sum(~observed_events & predicted_events))
    false_negative = int(np.sum(observed_events & ~predicted_events))
    precision = (
        true_positive / (true_positive + false_positive)
        if true_positive + false_positive
        else 0.0
    )
    recall = (
        true_positive / (true_positive + false_negative)
        if true_positive + false_negative
        else 0.0
    )
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {
        "threshold": threshold,
        "samples": int(valid.sum()),
        "true_positive": true_positive,
        "false_positive": false_positive,
        "false_negative": false_negative,
        "precision": precision,
        "recall": recall,
        "f1": f1,
    }
