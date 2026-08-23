"""Current PM2.5 readings from OpenAQ, nationwide.

Separate from ``openaq.py``, which is a 60-90 day historical backfill built to
assemble training data for leave-one-station-out validation. That job is clamped
to ``MIN_BACKFILL_DAYS = 60`` and replays months of measurements per sensor. It
is the wrong shape for answering "what is the air in this city now": a national
replay would be enormous, and an NCR-only run already took fifteen minutes before
failing.

This job answers the current question and nothing else.

Two things about the OpenAQ v3 API shape this code exists to work around.

**The latest-by-parameter endpoint ignores geography.** ``/v3/parameters/2/latest``
accepts ``bbox`` and ``coordinates`` and silently disregards both: the same 20,692
results come back either way, and the first page is East Asian. Filtering there
would have ingested global data believing it was Indian. ``/v3/locations?bbox=``
does filter correctly, so stations are discovered there and read individually.

**The bounding box is not a country.** ``68,6,98,38`` is a rectangle, and it
contains Peshawar, Lahore and Dhaka. A first run ingested Pakistani and
Bangladeshi stations as Indian ones, so the country code is checked as well.

**The latest endpoint does not say what it measured.** ``/locations/{id}/latest``
returns ``datetime``, ``value``, ``coordinates``, ``sensorsId`` and
``locationsId`` -- and no parameter. Values are identified only by sensor, so
every parameter a station reports comes back in the same list. Reading them
without resolving the sensor stored CO and PM10 as PM2.5, which is where a
"PM2.5" of 3320 ug/m3 came from. The sensor-to-parameter map is taken from the
locations listing, which carries it, so this costs no extra request.

**"Latest" does not mean recent.** Many Indian stations in OpenAQ stopped
reporting years ago; Delhi Technological University's latest measurement is dated
2018. Of 500 stations scanned, 286 had reported within six hours and 209 had not.
Stations outside the freshness window are skipped rather than ingested, because a
2018 reading rendered as current air quality is exactly the fabrication this
project exists to avoid.
"""

from __future__ import annotations

import argparse
import logging
import re
import time
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx

from ingestion.settings import settings
from ingestion.source import Source

logger = logging.getLogger(__name__)

BASE_URL = "https://api.openaq.org/v3"

# min-lon, min-lat, max-lon, max-lat covering mainland India and its islands.
INDIA_BBOX = "68,6,98,38"

PM25_PARAMETER_ID = 2
PM25_UNITS = {"ug/m3", "µg/m³"}
INDIA_COUNTRY_CODE = "IN"

# OpenAQ's `locality` is null for every Indian station -- all 168 in a national
# run -- so grouping by city has nothing to group by. The station name does carry
# it, in a shape the boards use consistently:
#
#     "R K Puram, Delhi - DPCC"
#     "Zoo Park, Hyderabad - TSPCB"
#     "Plammoodu, Thiruvananthapuram - Kerala PCB"
#
# Reading the city out of that is reading the operator's own text, not inferring
# one. It matched 167 of 168 names; the miss, "Tata Stadium - Jorapokhar - JSPCB",
# has no comma and is left without a city rather than guessed at.
STATION_CITY = re.compile(r"^.+,\s*([^,]+?)\s+-\s+[^,]+$")

PAGE_SIZE = 100
REQUEST_TIMEOUT = 45.0

# A national run makes several hundred requests in a row. A first attempt lost
# 120 of 300 stations to `Name or service not known` -- DNS refusing rather than
# OpenAQ refusing, which is what a burst of sequential connections from one
# container provokes.
#
# Retrying alone made it worse, not better: 149 failures instead of 120, because
# retries triple the connection volume on exactly the failures that too many
# connections caused. The fix is to stop opening a connection per request. A
# pooled client keeps the connection alive across stations, so several hundred
# reads cost a handful of DNS lookups instead of several hundred.
#
# The retry stays for the genuinely transient case, now that it is no longer
# competing with the thing it was meant to fix.
MAX_ATTEMPTS = 3
BACKOFF_SECONDS = 1.5

# Bounded so the pool cannot itself become the burst it exists to prevent.
CONNECTION_LIMITS = httpx.Limits(max_connections=8, max_keepalive_connections=8)

# A station whose most recent measurement is older than this is not reporting.
#
# Six hours, matched to what the upstream actually does.
#
# This was three hours, chosen on the assumption that CPCB and DPCC stations
# publish hourly. They do, but OpenAQ mirrors them with a lag: measured across a
# national run, no station's newest reading was under 120 minutes old, 217 sat
# between 120 and 180 minutes, and 44 were already past 180. A three hour window
# therefore marked a fifth of correctly-working stations stale on arrival and the
# rest within the hour, and cities disappeared from search and rankings between
# one page load and the next.
#
# The window's question is whether a station is still reporting, not whether a
# reading is instantaneous. Six hours answers that: a station on its normal
# cadence stays fresh, one that has actually stopped goes stale.
#
# This does not hide age. Every reading carries its measured time to the reader,
# and the map dims a stale one rather than concealing it.
#
# Kept equal to ReadQueryService.FRESHNESS so ingestion and the read API cannot
# disagree about what "currently reporting" means.
FRESHNESS = timedelta(hours=6)

# Bounds a single run. Without it the job's cost is set by however many stations
# OpenAQ happens to list, which is not a number this process should discover at
# runtime in production.
DEFAULT_MAX_STATIONS = 400


def _city_from_name(name: str) -> str | None:
    """City from a station name, or None when the name does not carry one.

    Returns None rather than a best guess. A ranking that lists a station under
    the wrong city is worse than one that omits it, because the omission is
    visible in the excluded count and the error is not.
    """
    match = STATION_CITY.match(name)
    return match.group(1).strip() if match else None


class OpenAqLatestSource(Source):
    """Most recent PM2.5 reading from each currently-reporting Indian station."""

    name = "OPENAQ_LATEST"
    fixture_file = "openaq_sample.json"

    def __init__(
        self,
        api_key: str | None,
        bbox: str = INDIA_BBOX,
        max_stations: int = DEFAULT_MAX_STATIONS,
    ) -> None:
        super().__init__(api_key)
        if max_stations < 1:
            raise ValueError("max_stations must be at least 1")
        self._bbox = bbox
        self._max_stations = max_stations
        self._client: httpx.Client | None = None

        # total_units, failed_units and failure_details come from Source and are
        # what the runner reads to decide PARTIAL. See ingestion.runner.

    # ---- HTTP ----------------------------------------------------------

    def _get(self, path: str, params: dict[str, Any] | None = None) -> dict:
        """One request, retried on transport failure.

        Retries transport errors and 5xx only. A 4xx is the server saying the
        request itself is wrong, and repeating it would just be rude.
        """
        last: Exception | None = None

        for attempt in range(MAX_ATTEMPTS):
            if attempt:
                time.sleep(BACKOFF_SECONDS * (2 ** (attempt - 1)))
            try:
                response = self._http().get(
                    path,
                    params=params or {},
                )
                if response.status_code >= 500:
                    response.raise_for_status()
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code < 500:
                    raise
                last = exc
            except httpx.HTTPError as exc:
                # Includes the DNS failures that cost 120 stations.
                last = exc

        assert last is not None
        raise last

    def _http(self) -> httpx.Client:
        """The pooled client, created on first use.

        Not built in __init__: a source in fixture mode never makes a request,
        and CI runs without a key.
        """
        if self._client is None:
            self._client = httpx.Client(
                base_url=BASE_URL,
                headers={"X-API-Key": self._api_key or ""},
                timeout=REQUEST_TIMEOUT,
                limits=CONNECTION_LIMITS,
            )
        return self._client

    def _close(self) -> None:
        if self._client is not None:
            self._client.close()
            self._client = None

    # ---- Discovery -----------------------------------------------------

    def _reporting_stations(self) -> list[dict]:
        """Stations inside the bbox whose last measurement is within FRESHNESS.

        ``datetimeLast`` comes back on the locations listing, so staleness is
        decided here without spending a request per station on the ones that
        turn out to be dead.
        """
        cutoff = datetime.now(UTC) - FRESHNESS
        stations: list[dict] = []
        page = 1

        while len(stations) < self._max_stations:
            payload = self._get(
                "/locations",
                {"bbox": self._bbox, "limit": PAGE_SIZE, "page": page, "order_by": "id"},
            )
            results = payload.get("results")
            if not isinstance(results, list) or not results:
                break

            for location in results:
                last = (location.get("datetimeLast") or {}).get("utc")
                if not last:
                    continue
                try:
                    reported_at = datetime.fromisoformat(str(last).replace("Z", "+00:00"))
                except ValueError:
                    logger.warning(
                        "Skipping OpenAQ location with unparsable datetimeLast: %s", last
                    )
                    continue
                if reported_at < cutoff:
                    continue

                # The bbox is a rectangle over South Asia, not India. Without
                # this, Lahore and Dhaka arrive as Indian stations.
                country = location.get("country") or {}
                if country.get("code") != INDIA_COUNTRY_CODE:
                    continue

                # Which of this station's sensors measure PM2.5. The latest
                # endpoint identifies values only by sensor id, so without this
                # map every parameter it reports would be read as PM2.5.
                pm25_sensors = {
                    sensor.get("id")
                    for sensor in location.get("sensors") or []
                    if (sensor.get("parameter") or {}).get("id") == PM25_PARAMETER_ID
                    and (sensor.get("parameter") or {}).get("units") in PM25_UNITS
                }
                if not pm25_sensors:
                    continue

                coordinates = location.get("coordinates") or {}
                latitude = coordinates.get("latitude")
                longitude = coordinates.get("longitude")
                name = location.get("name")
                if latitude is None or longitude is None or not isinstance(name, str) or not name:
                    continue

                stations.append(
                    {
                        "id": location.get("id"),
                        "name": name,
                        # locality when the source supplies one, otherwise read
                        # from the station name. `country` is deliberately not
                        # stored as `state`: see _to_record.
                        "city": location.get("locality") or _city_from_name(name),
                        "pm25_sensors": pm25_sensors,
                        "latitude": float(latitude),
                        "longitude": float(longitude),
                    }
                )
                if len(stations) >= self._max_stations:
                    break

            page += 1

        return stations

    # ---- Reading -------------------------------------------------------

    def _fetch_live(self) -> list[dict]:
        try:
            return self._fetch_all()
        finally:
            # The run is over either way; leaving sockets open outlives it.
            self._close()

    def _fetch_all(self) -> list[dict]:
        stations = self._reporting_stations()
        self.total_units = len(stations)
        self.failed_units = 0

        cutoff = datetime.now(UTC) - FRESHNESS
        records: list[dict] = []

        for station in stations:
            try:
                payload = self._get(f"/locations/{station['id']}/latest")
            except Exception as exc:  # noqa: BLE001 - one station must not end the run
                # Counted, not swallowed. A national run touches hundreds of
                # stations, so an upstream error on one is routine; ending the
                # whole run there discards every good reading already collected.
                # The count reaches ingestion_run so the gap stays visible.
                self.failed_units += 1
                self.failure_details.append(f"station {station['id']}: {exc}")
                logger.warning("OpenAQ station %s unavailable: %s", station["id"], exc)
                continue

            for measurement in payload.get("results") or []:
                record = self._to_record(station, measurement, cutoff)
                if record is not None:
                    records.append(record)

        return records

    def _to_record(self, station: dict, measurement: dict, cutoff: datetime) -> dict | None:
        """Convert one measurement, or return None if it is not usable."""
        # The response carries every parameter this station reports and names
        # none of them, so the only proof a value is PM2.5 is its sensor id.
        # Anything unrecognised is dropped rather than assumed.
        if measurement.get("sensorsId") not in station["pm25_sensors"]:
            return None

        value = measurement.get("value")
        if not isinstance(value, (int, float)):
            return None

        observed = (measurement.get("datetime") or {}).get("utc")
        if not observed:
            return None
        try:
            observed_at = datetime.fromisoformat(str(observed).replace("Z", "+00:00"))
        except ValueError:
            return None

        # A station can be listed as reporting while an individual sensor lags.
        if observed_at < cutoff:
            return None

        return {
            "station": station["name"],
            "city": station["city"],
            # Left unset. OpenAQ's `country` is a country, and openaq.py stores
            # it in `station.state`, so every Indian station reads "India".
            # A real state needs point-in-polygon against boundary geometry;
            # deriving one from an operator suffix such as DPCC would encode a
            # guess as a fact.
            "state": None,
            "latitude": station["latitude"],
            "longitude": station["longitude"],
            "last_update": observed_at.isoformat().replace("+00:00", "Z"),
            "pollutant_id": "PM2.5",
            "pollutant_avg": float(value),
            "station_source": "OPENAQ",
        }


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch current OpenAQ PM2.5 readings")
    parser.add_argument("--bbox", default=INDIA_BBOX, help="min-lon,min-lat,max-lon,max-lat")
    parser.add_argument("--max-stations", type=int, default=DEFAULT_MAX_STATIONS)
    parser.add_argument("--dry-run", action="store_true", help="fetch and validate without writing")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(message)s")

    from ingestion.db import write_station_readings
    from ingestion.runner import run_source

    source = OpenAqLatestSource(settings.openaq_api_key, args.bbox, args.max_stations)
    count = run_source(source, write_station_readings, dry_run=args.dry_run)
    print(
        f"OpenAQ latest {source.mode}: {count} records from "
        f"{source.total_units - source.failed_units}/{source.total_units} stations"
    )


if __name__ == "__main__":
    main()
