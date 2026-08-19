"""Validation protocol.

This package exists before any model does. The validation protocol is the
project's primary credibility claim, and retrofitting leave-one-station-out
cross-validation after models are written tends not to happen.

loso_cv.py     - leave-one-station-out, the spatial generalisation check
blocked_cv.py  - forward-chaining temporal, never random-split a time series
exceedance.py  - precision/recall/F1 on spikes, because RMSE hides them
calibration.py - a 90 percent interval must contain truth 90 percent of the time
"""
