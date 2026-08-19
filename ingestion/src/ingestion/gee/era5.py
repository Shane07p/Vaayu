"""ERA5 reanalysis and GFS forecast meteorology.

Collections: ``ECMWF/ERA5/HOURLY`` and ``NOAA/GFS0P25``.

Features that matter for air quality: boundary layer height, wind u/v,
relative humidity, temperature. Boundary layer height is what makes column AOD
translate to surface PM2.5 or not, so it is not optional.

IMD is deliberately not used: its bulk and programmatic data is restricted and
paid, and reproducibility from public data is a requirement for Digital Public
Good status.
"""
