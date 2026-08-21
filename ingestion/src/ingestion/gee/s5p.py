"""Sentinel-5P TROPOMI.

Collections: ``COPERNICUS/S5P/NRTI/L3_NO2`` and ``COPERNICUS/S5P/NRTI/L3_AER_AI``
at roughly 3.5 x 5.5 km, daily, about 3 hour latency.

NO2 is the combustion tracer that separates vehicle and industrial signals from
crop-residue smoke, and the absorbing aerosol index responds to smoke aloft that
surface monitors cannot see.

Gotcha that must not be "fixed": S5P returns small negative column values over
clean regions. These are physically meaningful retrieval noise, not errors.
Clipping them to zero biases the feature upward exactly where the air is
cleanest, so ``gee_s5p_snapshot.no2_column`` carries no non-negative constraint.
"""

from __future__ import annotations

import argparse
import json

from ingestion.gee.client import (
    EarthEngineUnavailableError,
    coverage_fraction,
    credentials_present,
    initialise,
)
from ingestion.settings import settings
from ingestion.source import Source, SourceUnavailableError

NO2_COLLECTION = "COPERNICUS/S5P/NRTI/L3_NO2"
AER_AI_COLLECTION = "COPERNICUS/S5P/NRTI/L3_AER_AI"
NO2_BAND = "tropospheric_NO2_column_number_density"
AER_AI_BAND = "absorbing_aerosol_index"
SCALE_METRES = 3500


class Sentinel5PSource(Source):
    """TROPOMI NO2 and absorbing aerosol index reduced onto the analysis grid."""

    name = "GEE_S5P"
    fixture_file = "gee_s5p_sample.json"

    def __init__(self, days_back: int = 1) -> None:
        super().__init__(
            api_key=settings.gee_service_account_key if credentials_present() else None
        )
        if days_back < 1:
            raise ValueError("days_back must be at least 1")
        self._days_back = days_back

    def _fetch_live(self) -> list[dict]:
        try:
            import ee

            initialise()

            end = ee.Date.now()
            start = end.advance(-self._days_back, "day")

            no2 = (
                ee.ImageCollection(NO2_COLLECTION)
                .filterDate(start, end)
                .select(NO2_BAND)
                .mean()
                .rename("no2_column")
            )
            aer_ai = (
                ee.ImageCollection(AER_AI_COLLECTION)
                .filterDate(start, end)
                .select(AER_AI_BAND)
                .mean()
                .rename("aer_ai")
            )

            from ingestion.gee.grid import grid_feature_collection

            reduced = no2.addBands(aer_ai).reduceRegions(
                collection=grid_feature_collection(),
                reducer=ee.Reducer.mean().combine(ee.Reducer.count(), sharedInputs=False),
                scale=SCALE_METRES,
            )

            timestamp = end.format().getInfo()
            return [
                self._to_row(feature["properties"], timestamp)
                for feature in reduced.getInfo().get("features", [])
            ]
        except EarthEngineUnavailableError as exc:
            raise SourceUnavailableError(f"{self.name}: {exc}") from exc

    def _to_row(self, properties: dict, timestamp: str) -> dict:
        count = properties.get("no2_column_count") or 0
        coverage = coverage_fraction(count, count if count else 1)

        # No clipping. A negative column over clean air is the instrument
        # telling the truth about its own noise floor.
        return {
            "grid_cell_code": properties.get("code"),
            "ts": timestamp,
            "no2_column": properties.get("no2_column_mean"),
            "aer_ai": properties.get("aer_ai_mean"),
            "coverage_fraction": coverage,
        }


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch Sentinel-5P onto the grid")
    parser.add_argument("--days-back", type=int, default=1)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    source = Sentinel5PSource(days_back=args.days_back)
    records = source.fetch()
    print(f"mode={source.mode} records={len(records)}")

    if args.dry_run:
        print(json.dumps(records[:3], indent=2))
        return

    from ingestion.db import record_run, write_s5p_snapshot

    written = write_s5p_snapshot(records, mode=source.mode)
    record_run(source.name, source.mode, "SUCCESS", row_count=written)
    print(f"written={written}")


if __name__ == "__main__":
    main()
