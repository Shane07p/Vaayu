"""OpenAQ v3 harmonised station data.

Versions 1 and 2 were retired on 31 January 2025 and return HTTP 410. Only v3
is usable. Requires an ``X-API-Key`` header. Values are raw ug/m3, which is why
this is the practical cross-border layer: national AQI scales are not
comparable across countries.

Implement: ``OpenAqSource(Source)`` taking a bbox, so the same client serves the
Delhi-NCR pull and the cross-border stretch goal.
"""

from __future__ import annotations

import argparse

import httpx

from ingestion.settings import settings
from ingestion.source import Source

BASE_URL = "https://api.openaq.org/v3"

# Delhi-NCR: min lon, min lat, max lon, max lat
NCR_BBOX = "76.8,28.2,77.6,28.9"


class OpenAqSource(Source):
    """OpenAQ v3 locations client using raw concentration-compatible data."""

    name = "OPENAQ"
    fixture_file = "openaq_sample.json"

    def __init__(self, api_key: str | None, bbox: str = NCR_BBOX) -> None:
        super().__init__(api_key)
        self._bbox = bbox

    def _fetch_live(self) -> list[dict]:
        response = httpx.get(
            f"{BASE_URL}/locations",
            params={"coordinates": self._bbox, "limit": 1_000},
            headers={"X-API-Key": self._api_key or ""},
            timeout=30.0,
        )
        response.raise_for_status()
        payload = response.json()
        records = payload.get("results")
        if not isinstance(records, list):
            raise ValueError("OpenAQ response did not contain a results list")
        return records


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch OpenAQ v3 locations")
    parser.add_argument("--bbox", default=NCR_BBOX, help="min-lon,min-lat,max-lon,max-lat")
    args = parser.parse_args()
    source = OpenAqSource(settings.openaq_api_key, args.bbox)
    print(f"OpenAQ {source.mode}: {len(source.fetch())} locations")
