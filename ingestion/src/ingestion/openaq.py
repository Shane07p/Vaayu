"""OpenAQ v3 harmonised station data.

Versions 1 and 2 were retired on 31 January 2025 and return HTTP 410. Only v3
is usable. Requires an ``X-API-Key`` header. Values are raw ug/m3, which is why
this is the practical cross-border layer: national AQI scales are not
comparable across countries.

Implement: ``OpenAqSource(Source)`` taking a bbox, so the same client serves the
Delhi-NCR pull and the cross-border stretch goal.
"""

from __future__ import annotations

BASE_URL = "https://api.openaq.org/v3"

# Delhi-NCR: min lon, min lat, max lon, max lat
NCR_BBOX = "76.8,28.2,77.6,28.9"
