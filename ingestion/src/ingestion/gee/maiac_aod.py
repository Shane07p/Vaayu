"""MODIS MAIAC aerosol optical depth.

Collection: ``MODIS/061/MCD19A2_GRANULES`` at 1 km, daily.
Bands: Optical_Depth_047, Optical_Depth_055, AOD_Uncertainty, Column_WV, AOD_QA.

Two things must not be skipped:

1. Decode the ``AOD_QA`` bitmask. Unmasked MAIAC includes low-confidence
   retrievals.
2. Report coverage fraction per cell. AOD has systematic gaps under cloud, snow,
   and high pollution, and the gaps are not random. Published Indian work found
   gap-blind analysis overestimated attributable mortality by roughly 94,000
   deaths over 2017-2022.

AOD is a column-integrated optical measure, not a surface concentration.
Converting it with a linear constant is the single most common technical error
in this problem space.
"""
