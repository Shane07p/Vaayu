"""Spike-detection metrics.

RMSE is dominated by ordinary days. The product is about episodes, so
precision, recall, and F1 at the exceedance threshold are reported alongside it.

Implement ``exceedance_metrics(y_true, y_pred, threshold=300.0) -> dict``.

Return zero rather than NaN when a period contains no exceedances, or the
seasonal breakdown table silently breaks on clean seasons.
"""

from __future__ import annotations
