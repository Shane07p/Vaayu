"""MODIS MAIAC aerosol optical depth.

Collection: ``MODIS/061/MCD19A2_GRANULES`` at 1 km, daily.
Bands: Optical_Depth_047, Optical_Depth_055, AOD_Uncertainty, Column_WV, AOD_QA.

Two things must not be skipped:

1. Decode the ``AOD_QA`` bitmask. Unmasked MAIAC includes low-confidence
   retrievals that look like data and are not.
2. Report coverage fraction per cell. AOD has systematic gaps under cloud,
   snow, and high pollution, and the gaps are not random. Published Indian work
   found gap-blind analysis overestimated attributable mortality by roughly
   94,000 deaths over 2017-2022.

AOD is a column-integrated optical measure, not a surface concentration.
Converting it with a linear constant is the single most common technical error
in this problem space, which is why ``gee_aod_snapshot`` has no pm25 column.
"""

from __future__ import annotations

import argparse
import json

from ingestion.gee.client import (
    EarthEngineUnavailableError,
    coverage_fraction,
    credentials_present,
    initialise,
    snapshot_timestamp,
)
from ingestion.settings import settings
from ingestion.source import Source, SourceUnavailableError

COLLECTION = "MODIS/061/MCD19A2_GRANULES"
SCALE_METRES = 1000

# MCD19A2 AOD_QA bit layout, from the MODIS MAIAC user guide:
#
#   bits 0-2   Cloud Mask            001 = Clear
#   bits 3-4   Land/Water/Snow/Ice   00  = Land
#   bits 5-7   Adjacency Mask        000 = Normal
#   bits 8-11  QA for AOD            0000 = Best quality
#   bits 12-14 Estimated Uncertainty
#
# Note: the implementation plan described this as "bits 0-1 cloud, bits 2-4
# retrieval quality". That does not match the published band spec, so the
# layout above is used instead. Getting this wrong silently admits cloudy and
# low-confidence retrievals into the training data.
CLOUD_MASK_SHIFT = 0
CLOUD_MASK_WIDTH = 3
CLOUD_MASK_CLEAR = 0b001

AOD_QA_SHIFT = 8
AOD_QA_WIDTH = 4
AOD_QA_BEST = 0b0000


class MaiacAodSource(Source):
    """MAIAC AOD reduced onto the analysis grid, with honest coverage accounting."""

    name = "GEE_MAIAC_AOD"
    fixture_file = "gee_aod_sample.json"

    def __init__(self, days_back: int = 1) -> None:
        # Credentials play the same role an API key does for the HTTP sources:
        # absent means fixture mode, present means live.
        super().__init__(
            api_key=settings.gee_service_account_key if credentials_present() else None
        )
        if days_back < 1:
            raise ValueError("days_back must be at least 1")
        self._days_back = days_back

    def _quality_mask(self, image):  # noqa: ANN001 - ee.Image, imported lazily
        """Keep only clear-sky, best-quality retrievals."""
        qa = image.select("AOD_QA")
        cloud = qa.rightShift(CLOUD_MASK_SHIFT).bitwiseAnd((1 << CLOUD_MASK_WIDTH) - 1)
        aod_quality = qa.rightShift(AOD_QA_SHIFT).bitwiseAnd((1 << AOD_QA_WIDTH) - 1)
        return image.updateMask(cloud.eq(CLOUD_MASK_CLEAR).And(aod_quality.eq(AOD_QA_BEST)))

    def _fetch_live(self) -> list[dict]:
        try:
            import ee

            initialise()

            # Computed once in Python rather than per feature: calling
            # ee.Date.now().format().getInfo() inside the row loop would cost one
            # network round trip per grid cell and re-evaluate the clock each
            # time, scattering one snapshot across hundreds of ts values.
            # Hour-aligned so all three snapshot tables share a ts and can be
            # joined. See snapshot_timestamp for why this matters.
            timestamp = snapshot_timestamp()

            end = ee.Date(timestamp)
            start = end.advance(-self._days_back, "day")

            masked = (
                ee.ImageCollection(COLLECTION)
                .filterDate(start, end)
                .select(
                    [
                        "Optical_Depth_047",
                        "Optical_Depth_055",
                        "AOD_Uncertainty",
                        "Column_WV",
                        "AOD_QA",
                    ]
                )
                .map(self._quality_mask)
                .mean()
            )

            # The denominator must be every pixel in the cell, not every pixel
            # that happened to carry an AOD value. MAIAC bands are masked at
            # source where retrieval failed, so counting them would compare
            # retrievals against retrievals and report near-total coverage over
            # a cell the satellite barely saw -- precisely the gap-blindness
            # this pipeline exists to avoid.
            total = ee.Image.constant(1).rename("total").toFloat()

            from ingestion.gee.grid import grid_feature_collection

            # sharedInputs=True: both reducers consume the same bands. With
            # False the combined reducer expects a separate input per reducer,
            # which misaligns the outputs _to_row reads.
            reduced = masked.addBands(total).reduceRegions(
                collection=grid_feature_collection(),
                reducer=ee.Reducer.mean().combine(
                    ee.Reducer.count(), outputPrefix="n_", sharedInputs=True
                ),
                scale=SCALE_METRES,
            )

            return [
                self._to_row(feature["properties"], timestamp)
                for feature in reduced.getInfo().get("features", [])
            ]
        except EarthEngineUnavailableError as exc:
            raise SourceUnavailableError(f"{self.name}: {exc}") from exc

    def _to_row(self, properties: dict, timestamp: str) -> dict:
        # Reducer output names: mean keeps the band name, count is prefixed.
        observed = properties.get("n_Optical_Depth_047")
        expected = properties.get("n_total")
        coverage = coverage_fraction(observed, expected)

        # The schema forbids a value without coverage. Enforce it here too, so a
        # masked cell is recorded as "could not see" rather than as clean air.
        has_signal = coverage > 0
        return {
            "grid_cell_code": properties.get("code"),
            "ts": timestamp,
            "aod_047": properties.get("Optical_Depth_047") if has_signal else None,
            "aod_055": properties.get("Optical_Depth_055") if has_signal else None,
            "aod_uncertainty": properties.get("AOD_Uncertainty") if has_signal else None,
            "column_wv": properties.get("Column_WV") if has_signal else None,
            "coverage_fraction": coverage,
            "qa_passed": has_signal,
        }


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch MAIAC AOD onto the grid")
    parser.add_argument("--days-back", type=int, default=1)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print records instead of writing to the database.",
    )
    args = parser.parse_args()

    source = MaiacAodSource(days_back=args.days_back)
    records = source.fetch()
    print(f"mode={source.mode} records={len(records)}")

    if args.dry_run:
        print(json.dumps(records[:3], indent=2))
        return

    from ingestion.db import write_aod_snapshot
    from ingestion.runner import run_source

    # run_source records the outcome whether it succeeds, hits an upstream
    # outage, or crashes. Recording only on success left failures invisible.
    written = run_source(source, write_aod_snapshot)
    print(f"written={written}")


if __name__ == "__main__":
    main()
