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

import argparse
import csv
from io import StringIO

import httpx

from ingestion.db import write_fire_detections
from ingestion.settings import settings
from ingestion.source import Source

BASE_URL = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"

# Punjab and Haryana source corridor
CORRIDOR_BBOX = "73.8,29.5,77.5,32.5"


class FirmsSource(Source):
    """FIRMS area API client for VIIRS active-fire detections."""

    name = "FIRMS"
    fixture_file = "firms_sample.json"

    def __init__(self, api_key: str | None, bbox: str = CORRIDOR_BBOX, days: int = 1) -> None:
        super().__init__(api_key)
        if not 1 <= days <= 10:
            raise ValueError("days must be between 1 and 10")
        self._bbox = bbox
        self._days = days

    def _fetch_live(self) -> list[dict]:
        response = httpx.get(
            f"{BASE_URL}/{self._api_key}/VIIRS_SNPP/world/{self._days}/{self._bbox}",
            timeout=30.0,
        )
        response.raise_for_status()
        return list(csv.DictReader(StringIO(response.text)))


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest FIRMS active-fire detections")
    parser.add_argument("--dry-run", action="store_true", help="fetch and validate without writing")
    parser.add_argument("--days", type=int, default=1, help="recent days to request (1-10)")
    args = parser.parse_args()
    source = FirmsSource(settings.firms_map_key, days=args.days)
    records = source.fetch()
    count = len(records) if args.dry_run else write_fire_detections(records, source.mode)
    print(f"FIRMS {source.mode}: {count} records")
