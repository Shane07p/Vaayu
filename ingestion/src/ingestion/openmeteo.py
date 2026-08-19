"""Open-Meteo CAMS-based air quality forecast.

This is the baseline the forecast model must beat, not a training source. A
model that does not beat it is reported as not beating it.

No API key is required for non-commercial use, so this source is always live.

Implement: ``OpenMeteoSource(Source)`` overriding the key requirement.
"""

from __future__ import annotations

BASE_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"

DELHI_LAT = 28.6139
DELHI_LON = 77.2090
