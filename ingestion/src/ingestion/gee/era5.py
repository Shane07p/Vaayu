"""ERA5 reanalysis and GFS forecast meteorology.

Collections: ``ECMWF/ERA5/HOURLY`` (past) and ``NOAA/GFS0P25`` (future).

Boundary layer height is what makes column AOD translate to surface PM2.5 or
not: the same aerosol column over a 200 m winter inversion and a 2000 m
afternoon mixing layer means an order of magnitude difference at the surface.
It is not an optional feature.

Wind u and v feed the back-trajectory in ``vaayu_ml.trajectory``, which is what
turns a fire detection into an attribution claim.

IMD is deliberately not used: its bulk and programmatic data is restricted and
paid, and reproducibility from public data is a requirement for Digital Public
Good status.
"""

from __future__ import annotations

import argparse
import json

from ingestion.gee.client import (
    EarthEngineUnavailableError,
    credentials_present,
    initialise,
    snapshot_timestamp,
)
from ingestion.settings import settings
from ingestion.source import Source, SourceUnavailableError

REANALYSIS_COLLECTION = "ECMWF/ERA5/HOURLY"
FORECAST_COLLECTION = "NOAA/GFS0P25"
SCALE_METRES = 11000

# ERA5 hourly band names, mapped to our column names. ERA5 reports
# temperature in kelvin and carries no relative humidity band; RH would have to
# be derived from dewpoint, which is not done here, so met_snapshot.
# relative_humidity is null for REANALYSIS rows by design rather than by
# accident.
REANALYSIS_BANDS = {
    "boundary_layer_height": "boundary_layer_height",
    "u_component_of_wind_10m": "wind_u",
    "v_component_of_wind_10m": "wind_v",
    "temperature_2m": "temp_2m",
    "surface_pressure": "surface_pressure",
    "total_precipitation_hourly": "precipitation",
}

# GFS uses different names for the same physics, reports temperature already in
# celsius, and exposes no boundary layer height. FORECAST rows therefore carry a
# null boundary_layer_height; the nowcast uses REANALYSIS rows, which do have it.
FORECAST_BANDS = {
    "u_component_of_wind_10m_above_ground": "wind_u",
    "v_component_of_wind_10m_above_ground": "wind_v",
    "temperature_2m_above_ground": "temp_2m",
    "relative_humidity_2m_above_ground": "relative_humidity",
    "total_precipitation_surface": "precipitation",
}

# Columns each source cannot supply. Recorded explicitly so a permanently null
# column is a documented gap rather than a silent one.
UNAVAILABLE_BY_KIND = {
    "REANALYSIS": ("relative_humidity",),
    "FORECAST": ("boundary_layer_height", "surface_pressure"),
}

# ERA5 is kelvin; GFS is already celsius. Applying the offset to both wrote
# roughly -253 C for every forecast row, and no CHECK constraint catches it.
KELVIN_OFFSET = 273.15


class Era5Source(Source):
    """Meteorology reduced onto the analysis grid.

    ``kind`` selects reanalysis (past, ERA5) or forecast (future, GFS). Both
    land in ``met_snapshot``, distinguished by the ``kind`` column, because the
    forecast model needs future meteorology and the nowcast needs past.
    """

    name = "GEE_ERA5"
    fixture_file = "met_sample.json"

    def __init__(self, hours_back: int = 24, kind: str = "REANALYSIS") -> None:
        super().__init__(
            api_key=settings.gee_service_account_key if credentials_present() else None
        )
        if kind not in {"REANALYSIS", "FORECAST"}:
            raise ValueError("kind must be REANALYSIS or FORECAST")
        if hours_back < 1:
            raise ValueError("hours_back must be at least 1")
        self._hours_back = hours_back
        self._kind = kind

    @property
    def kind(self) -> str:
        return self._kind

    def _fetch_live(self) -> list[dict]:
        try:
            import ee

            initialise()

            forecast = self._kind == "FORECAST"
            collection_id = FORECAST_COLLECTION if forecast else REANALYSIS_COLLECTION
            bands = FORECAST_BANDS if forecast else REANALYSIS_BANDS

            # Computed once in Python: see the note in maiac_aod._fetch_live.
            # Hour-aligned so all three snapshot tables share a ts and can be
            # joined. See snapshot_timestamp for why this matters.
            timestamp = snapshot_timestamp()

            now = ee.Date(timestamp)
            if forecast:
                start, end = now, now.advance(self._hours_back, "hour")
            else:
                start, end = now.advance(-self._hours_back, "hour"), now

            # The most recent image in the window, not the mean of it.
            # Averaging 24 hours of wind vectors cancels a steady northwesterly
            # against a morning reversal and yields near-zero flow, which would
            # send the back-trajectory nowhere. Averaging boundary layer height
            # likewise erases the diurnal collapse that drives evening episodes.
            image = (
                ee.ImageCollection(collection_id)
                .filterDate(start, end)
                .select(list(bands), list(bands.values()))
                .sort("system:time_start", False)
                .first()
            )

            from ingestion.gee.grid import grid_feature_collection

            reduced = image.reduceRegions(
                collection=grid_feature_collection(),
                reducer=ee.Reducer.mean(),
                scale=SCALE_METRES,
            )

            return [
                self._to_row(feature["properties"], timestamp)
                for feature in reduced.getInfo().get("features", [])
            ]
        except EarthEngineUnavailableError as exc:
            raise SourceUnavailableError(f"{self.name}: {exc}") from exc

    def _to_row(self, properties: dict, timestamp: str) -> dict:
        temperature = properties.get("temp_2m")
        # ERA5 reports kelvin, GFS reports celsius. Converting both wrote about
        # -253 C for every forecast row.
        if isinstance(temperature, int | float) and self._kind == "REANALYSIS":
            temperature = float(temperature) - KELVIN_OFFSET

        return {
            "grid_cell_code": properties.get("code"),
            "ts": timestamp,
            "kind": self._kind,
            "boundary_layer_height": properties.get("boundary_layer_height"),
            "wind_u": properties.get("wind_u"),
            "wind_v": properties.get("wind_v"),
            "temp_2m": temperature,
            "relative_humidity": properties.get("relative_humidity"),
            "surface_pressure": properties.get("surface_pressure"),
            "precipitation": properties.get("precipitation"),
        }


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch meteorology onto the grid")
    parser.add_argument("--hours-back", type=int, default=24)
    parser.add_argument("--kind", choices=("REANALYSIS", "FORECAST"), default="REANALYSIS")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    source = Era5Source(hours_back=args.hours_back, kind=args.kind)
    records = source.fetch()
    print(f"mode={source.mode} kind={args.kind} records={len(records)}")

    if args.dry_run:
        print(json.dumps(records[:3], indent=2))
        return

    from ingestion.db import write_met_snapshot
    from ingestion.runner import run_source

    # run_source records the outcome whether it succeeds, hits an upstream
    # outage, or crashes. Recording only on success left failures invisible.
    written = run_source(source, write_met_snapshot)
    print(f"written={written}")


if __name__ == "__main__":
    main()
