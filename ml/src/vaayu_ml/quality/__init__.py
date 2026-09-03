"""Data-quality checks for measured station readings.

This is intentionally a fault detector, not an air-quality predictor. It is
optimised for precision because no labelled fault set exists: a false flag
removes a real measurement from the product until a reviewer clears it.
"""

from vaayu_ml.quality.anomaly import AnomalyCandidate, detect_anomalies

__all__ = ["AnomalyCandidate", "detect_anomalies"]
