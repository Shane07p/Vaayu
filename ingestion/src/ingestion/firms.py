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
from ingestion.source import Source, SourceUnavailableError

BASE_URL = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"

# Punjab and Haryana source corridor
CORRIDOR_BBOX = "73.8,29.5,77.5,32.5"

SENSOR = "VIIRS_SNPP_NRT"

# VIIRS reports confidence as a letter. Low-confidence detections are often
# gas flares, hot roofs, or sun glint, and admitting them inflates cluster
# detection counts, which propagates straight into the impact ranking that
# tells a district magistrate where to send an officer.
ACCEPTED_CONFIDENCE = frozenset({"h", "n"})

# MODIS reports confidence as a 0-100 integer instead of a letter.
MODIS_CONFIDENCE_FLOOR = 30


def accepts_confidence(value: object) -> bool:
    """Whether a detection is confident enough to act on.

    Handles both the VIIRS letter scale and the MODIS integer scale, because
    the fixture and the live feed may carry either.
    """
    if value is None:
        return False

    raw = str(value).strip().lower()
    if not raw:
        return False
    if raw in ACCEPTED_CONFIDENCE:
        return True
    if raw == "l":
        return False

    try:
        return int(float(raw)) >= MODIS_CONFIDENCE_FLOOR
    except ValueError:
        return False


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

    def fetch(self) -> list[dict]:
        """Fetch detections, dropping any that are not confident enough.

        Filtering here rather than in the writer means fixture and live records
        pass through identical rules, so the offline demo cannot show counts the
        live pipeline would never produce.

        Raises:
            SourceUnavailableError: the response carried rows but no confidence
                column at all. That is a schema change or an error page, not a
                day with no fires, and silently returning an empty list would
                record a zero-row SUCCESS and hide the outage.
        """
        records = super().fetch()
        if records and not any("confidence" in record for record in records):
            raise SourceUnavailableError(
                f"{self.name}: response has no confidence column; "
                f"refusing to report {len(records)} unverifiable detections"
            )

        return [record for record in records if accepts_confidence(record.get("confidence"))]

    def _fetch_live(self) -> list[dict]:
        # Format per the FIRMS API itself:
        #   area/csv/[MAP_KEY]/[SOURCE]/[AREA_COORDINATES]/[DAY_RANGE]
        # Coordinates precede the day range. Putting "world" in the area slot
        # requests global detections and silently ignores the corridor.
        response = httpx.get(
            f"{BASE_URL}/{self._api_key}/{SENSOR}/{self._bbox}/{self._days}",
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
