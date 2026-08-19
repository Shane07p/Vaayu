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
