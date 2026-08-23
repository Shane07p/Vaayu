"""CPCB real-time AQI via the sanctioned data.gov.in resource.

The ``app.cpcbccr.com`` station API used by many projects is reverse-engineered
and unofficial. This module deliberately uses the data.gov.in route instead,
which is slightly less convenient and officially sanctioned.

Response gotcha: fields are ``pollutant_min`` / ``pollutant_max`` /
``pollutant_avg`` per pollutant, not a single value per station. Timestamps are
``DD-MM-YYYY HH:MM:SS`` in IST and are occasionally stale.

Implement: ``CpcbSource(Source)`` with ``_fetch_live``, and a ``main()``
supporting ``--dry-run``.
"""

from __future__ import annotations

import argparse

import httpx

from ingestion.db import write_station_readings
from ingestion.runner import run_source
from ingestion.settings import settings
from ingestion.source import Source

RESOURCE_ID = "3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69"
BASE_URL = f"https://api.data.gov.in/resource/{RESOURCE_ID}"


class CpcbSource(Source):
    """Sanctioned data.gov.in client for hourly CPCB AQI records."""

    name = "CPCB"
    fixture_file = "cpcb_sample.json"

    def _fetch_live(self) -> list[dict]:
        response = httpx.get(
            BASE_URL,
            params={"api-key": self._api_key, "format": "json", "limit": 5_000},
            timeout=30.0,
        )
        response.raise_for_status()
        payload = response.json()
        records = payload.get("records")
        if not isinstance(records, list):
            raise ValueError("CPCB response did not contain a records list")
        return records


def run_cpcb(source: CpcbSource, dry_run: bool = False) -> int:
    """Execute CPCB ingestion through the shared provenance-aware runner."""
    return run_source(source, write_station_readings, dry_run=dry_run)


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest CPCB station readings")
    parser.add_argument("--dry-run", action="store_true", help="fetch and validate without writing")
    args = parser.parse_args()
    source = CpcbSource(settings.data_gov_in_api_key)
    count = run_cpcb(source, args.dry_run)
    print(f"CPCB {source.mode}: {count} records")
