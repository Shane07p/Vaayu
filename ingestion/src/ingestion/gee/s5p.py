"""Sentinel-5P TROPOMI.

Collections: ``COPERNICUS/S5P/NRTI/L3_NO2`` and ``COPERNICUS/S5P/NRTI/L3_AER_AI``
at roughly 3.5 x 5.5 km, daily, about 3 hour latency.

Gotcha: S5P returns small negative column values over clean regions. These are
physically meaningful retrieval noise and must not be clipped to zero.
"""
