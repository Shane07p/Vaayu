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
import math
import re
import time
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx

from ingestion.openaq import RequestRateLimiter, _retry_after_seconds
from ingestion.settings import settings
from ingestion.source import Source

logger = logging.getLogger(__name__)

BASE_URL = "https://api.openaq.org/v3"

# min-lon, min-lat, max-lon, max-lat covering mainland India and its islands.
INDIA_BBOX = "68,6,98,38"

PM25_PARAMETER_ID = 2
PM25_UNITS = {"ug/m3", "µg/m³"}
INDIA_COUNTRY_CODE = "IN"

# OpenAQ's `locality` is null for almost every Indian station -- all 168 in one
# national run -- so grouping by city has nothing to group by. Where it is set it
# is not always a city: three stations return the country, "India". See
# `_city_of`, which is what decides whether to believe it.
#
# The station name does carry the city, in a shape the boards use consistently:
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

# A pooled client avoids needless connections; RequestRateLimiter spaces every
# request at the documented key quota so neither discovery nor station reads burst.
CONNECTION_LIMITS = httpx.Limits(max_connections=8, max_keepalive_connections=8)


# How far back a reading may be and still be worth storing.
#
# Deliberately not the same as the API's staleness bar
# (ReadQueryService.FRESHNESS, six hours). That one answers "should a reader be
# told this is current"; this one answers "is this a real measurement we should
# keep". They are different questions, and conflating them cost us the dataset.
#
# OpenAQ's mirror of the CPCB and state-board network does not publish
# continuously. Until 23 August its lag sat inside six hours, so the two windows
# happened to agree and nothing was lost. The lag then grew to roughly 36-48
# hours, and because discovery filtered at six, the collector began discarding
# almost the entire government network while still reporting SUCCESS: 286 rows
# on 23 August, 26 on 4 September. Measured against the live API on 4 September,
# 53 Indian stations had reported within six hours and 531 within forty-eight.
#
# A reading forty hours old is not a false reading. It is a true measurement of
# a past hour, and it is stored with the measured time it actually carries. What
# a reader is told about it is decided downstream, where the age is known and
# shown -- never here, by throwing it away.
INGEST_WINDOW = timedelta(hours=72)

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


def _city_of(location: dict, name: str) -> str | None:
    """The city to file a station under, or None.

    ``locality`` is preferred when the source supplies a usable one, and the
    station name is read otherwise.

    The check on ``locality`` is not defensive tidying. The module docstring
    recorded that OpenAQ returns a null locality for every Indian station, which
    was true of the run it was measured on and is no longer true: three stations
    now come back with ``locality`` set to the string "India". Taken at face
    value that stored a country as a city, and because the ranking groups by
    ``station.city`` and orders by the worst reading, "India" appeared in the
    citizen rankings as a city in its own right -- above every real one, since
    it aggregated stations from Delhi, Mumbai and Chennai at once.

    A locality equal to the station's own country is not a locality. Those three
    stations are named "New Delhi", "Mumbai" and "Chennai", which carry no comma
    and so yield no city from the name either; they are left unattributed and
    counted in the ranking's `unattributedStations`, where their absence is
    visible. That is the standing rule here: an omission a reader can see beats
    an attribution a reader cannot check.
    """
    country = location.get("country") or {}
    disallowed = {
        str(value).strip().casefold()
        for value in (country.get("name"), country.get("code"))
        if value
    }

    locality = location.get("locality")
    if isinstance(locality, str) and locality.strip():
        if locality.strip().casefold() not in disallowed:
            return locality.strip()
        logger.warning(
            "Ignoring OpenAQ locality %r for station %r: it names the country, not a city",
            locality,
            name,
        )

    return _city_from_name(name)


class OpenAqLatestSource(Source):
    """Most recent PM2.5 reading from each currently-reporting Indian station."""

    name = "OPENAQ_LATEST"
    fixture_file = "openaq_sample.json"

    def __init__(
        self,
        api_key: str | None,
        bbox: str = INDIA_BBOX,
        max_stations: int = DEFAULT_MAX_STATIONS,
        requests_per_minute: int | None = None,
        max_429_retries: int | None = None,
        clock=time.monotonic,
        sleeper=time.sleep,
    ) -> None:
        super().__init__(api_key)
        if max_stations < 1:
            raise ValueError("max_stations must be at least 1")
        self._bbox = bbox
        self._max_stations = max_stations
        self._client: httpx.Client | None = None
        request_rate = (
            settings.openaq_requests_per_minute
            if requests_per_minute is None
            else requests_per_minute
        )
        self._rate_limiter = RequestRateLimiter(request_rate, clock=clock, sleeper=sleeper)
        self._sleeper = sleeper
        self._max_429_retries = (
            settings.openaq_max_429_retries if max_429_retries is None else max_429_retries
        )
        if self._max_429_retries < 0:
            raise ValueError("OpenAQ 429 retries cannot be negative")
        self.rate_limit_hits = 0

        # total_units, failed_units and failure_details come from Source and are
        # what the runner reads to decide PARTIAL. See ingestion.runner.

    # ---- HTTP ----------------------------------------------------------

    def _get(self, path: str, params: dict[str, Any] | None = None) -> dict:
        """Make one rate-controlled request, retrying only explicit 429 delays."""
        for attempt in range(self._max_429_retries + 1):
            self._rate_limiter.wait()
            response = self._http().get(path, params=params or {})
            if response.status_code != 429:
                response.raise_for_status()
                payload = response.json()
                if not isinstance(payload, dict):
                    raise ValueError("OpenAQ response must be an object")
                return payload

            self.rate_limit_hits += 1
            now = datetime.now(UTC)
            retry_after = _retry_after_seconds(response.headers.get("Retry-After"), now)
            if retry_after is None:
                retry_after = _retry_after_seconds(response.headers.get("X-RateLimit-Reset"), now)
            if retry_after is None or attempt == self._max_429_retries:
                response.raise_for_status()
            logger.warning("OpenAQ rate limited %s; Retry-After: %.2f seconds", path, retry_after)
            logger.info("Retrying OpenAQ %s", path)
            self._sleeper(retry_after)
        raise AssertionError("bounded OpenAQ 429 retry loop exhausted")

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
        """Stations inside the bbox that have reported within INGEST_WINDOW.

        ``datetimeLast`` comes back on the locations listing, so a station that
        has genuinely stopped is dropped here without spending a request per
        station on the ones that turn out to be dead.

        The bound is INGEST_WINDOW, not FRESHNESS: this decides what is worth
        storing, not what a reader may be told is current.
        """
        cutoff = datetime.now(UTC) - INGEST_WINDOW
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
                        # locality when the source supplies a usable one,
                        # otherwise read from the station name. `country` is
                        # deliberately not stored as `state`: see _to_record.
                        "city": _city_of(location, name),
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

        # Same bound as discovery, so a station that passed the listing check is
        # not then dropped when its individual readings are read back.
        cutoff = datetime.now(UTC) - INGEST_WINDOW
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
        if not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
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
    from ingestion.quality import scan_recent_openaq_readings
    from ingestion.runner import run_source

    source = OpenAqLatestSource(settings.openaq_api_key, args.bbox, args.max_stations)
    count = run_source(source, write_station_readings, dry_run=args.dry_run)
    flagged = 0 if args.dry_run else scan_recent_openaq_readings()
    print(
        f"OpenAQ latest {source.mode}: {count} records from "
        f"{source.total_units - source.failed_units}/{source.total_units} stations; "
        f"{flagged} quality holdouts"
    )


if __name__ == "__main__":
    main()
