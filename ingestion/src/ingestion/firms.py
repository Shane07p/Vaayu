"""NASA FIRMS active fire detections.

Sensors: VIIRS S-NPP / NOAA-20 / NOAA-21 at 375 m, MODIS at 1 km. Free MAP_KEY,
limit 5,000 transactions per 10 minutes, roughly 3 hour latency.

Detection counts are a floor, not a census. Satellites overpass at roughly 13:30
and after midnight, and burning has demonstrably shifted to evening hours to
evade them: field validation found satellites detected only 7 of 169 fires
visible in high-resolution imagery. Citizen reports partially mitigate this gap.
They do not close it.

Response is CSV, not JSON.

Implement: ``FirmsSource(Source)`` with ``_fetch_live`` parsing CSV.
"""

from __future__ import annotations

BASE_URL = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"

# Punjab and Haryana source corridor
CORRIDOR_BBOX = "73.8,29.5,77.5,32.5"
