"""Prediction-interval calibration.

A 90 percent interval must contain the truth about 90 percent of the time. An
interval that does not is a confidence claim the model has not earned.

Implement ``interval_coverage(y_true, lower, upper) -> dict`` and a reliability
diagram over the quantile predictions in ``grid_prediction``.
"""

from __future__ import annotations
