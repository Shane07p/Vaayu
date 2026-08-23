"""Historical OpenAQ v3 PM2.5 ingestion for the Delhi-NCR bounding box."""

from __future__ import annotations

import argparse
import logging
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx

from ingestion.db import write_station_readings
from ingestion.runner import run_source
from ingestion.settings import settings
from ingestion.source import Source

BASE_URL = "https://api.openaq.org/v3"
NCR_BBOX = "76.8,28.2,77.6,28.9"
DEFAULT_BACKFILL_DAYS = 90
MIN_BACKFILL_DAYS = 60
PAGE_SIZE = 1_000
MAX_PAGES = 10_000
PM25_UNITS = frozenset({"µg/m³", "µg/m3", "ug/m3"})
HTTP_TIMEOUT = httpx.Timeout(connect=10.0, read=30.0, write=10.0, pool=10.0)
HTTP_LIMITS = httpx.Limits(max_connections=10, max_keepalive_connections=5)

logger = logging.getLogger(__name__)


def _utc_timestamp(value: str) -> datetime:
    """Parse an ISO-8601 timestamp and reject timezone-naive values."""
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("OpenAQ datetime must be ISO-8601") from exc
    if parsed.tzinfo is None:
        raise ValueError("OpenAQ datetime must include a timezone")
    return parsed.astimezone(UTC)


def _pm25_parameter(name: object) -> bool:
    return isinstance(name, str) and name.casefold().replace(".", "") == "pm25"


class OpenAqSource(Source):
    """Fetch and normalize up to 90 days of OpenAQ v3 PM2.5 measurements."""

    name = "OPENAQ"
    fixture_file = "openaq_sample.json"

    def __init__(
        self,
        api_key: str | None,
        bbox: str = NCR_BBOX,
        days: int = DEFAULT_BACKFILL_DAYS,
        end: datetime | None = None,
        latest: bool = False,
    ) -> None:
        super().__init__(api_key)
        if not latest and not MIN_BACKFILL_DAYS <= days <= DEFAULT_BACKFILL_DAYS:
            raise ValueError(
                "OpenAQ backfill days must be between "
                f"{MIN_BACKFILL_DAYS} and {DEFAULT_BACKFILL_DAYS}"
            )
        if end is not None and end.tzinfo is None:
            raise ValueError("OpenAQ backfill end must include a timezone")
        self._bbox = bbox
        self._end = (end or datetime.now(UTC)).astimezone(UTC).replace(microsecond=0)
        self._start = self._end - (timedelta(hours=1) if latest else timedelta(days=days))

    @property
    def start(self) -> datetime:
        return self._start

    @property
    def end(self) -> datetime:
        return self._end

    def _request_pages(
        self, client: httpx.Client, path: str, params: dict[str, object]
    ) -> list[dict[str, Any]]:
        """Fetch every OpenAQ page while rejecting malformed pagination metadata."""
        records: list[dict[str, Any]] = []
        for requested_page in range(1, MAX_PAGES + 1):
            response = client.get(
                f"{BASE_URL}{path}",
                params={**params, "page": requested_page, "limit": PAGE_SIZE},
                headers={"X-API-Key": self._api_key or ""},
            )
            response.raise_for_status()
            payload = response.json()
            if not isinstance(payload, dict):
                raise ValueError("OpenAQ response must be an object")
            page_records = payload.get("results")
            meta = payload.get("meta")
            if not isinstance(page_records, list) or not isinstance(meta, dict):
                raise ValueError("OpenAQ response did not contain results and pagination metadata")
            if meta.get("page", requested_page) != requested_page:
                raise ValueError("OpenAQ response page does not match the requested page")
            if not all(isinstance(record, dict) for record in page_records):
                raise ValueError("OpenAQ results must contain objects")
            records.extend(page_records)

            if not page_records:
                return records
            found = meta.get("found")
            limit = meta.get("limit", PAGE_SIZE)
            if isinstance(found, int) and isinstance(limit, int) and limit > 0:
                if requested_page * limit >= found:
                    return records
            elif len(page_records) < PAGE_SIZE:
                return records
        raise ValueError(f"OpenAQ pagination exceeded {MAX_PAGES} pages for {path}")

    def _locations(self, client: httpx.Client) -> list[dict[str, Any]]:
        return self._request_pages(
            client, "/locations", {"bbox": self._bbox, "order_by": "id"}
        )

    def _measurement_records(
        self, client: httpx.Client, location: dict[str, Any]
    ) -> list[dict]:
        name = location.get("name")
        coordinates = location.get("coordinates")
        sensors = location.get("sensors")
        if not isinstance(name, str) or not name or not isinstance(coordinates, dict):
            logger.warning("Skipping malformed OpenAQ location")
            return []
        latitude = coordinates.get("latitude")
        longitude = coordinates.get("longitude")
        if not isinstance(latitude, (int, float)) or not isinstance(longitude, (int, float)):
            logger.warning("Skipping OpenAQ location %s without coordinates", name)
            return []
        if not isinstance(sensors, list):
            logger.warning("Skipping OpenAQ location %s without sensors", name)
            return []

        country = location.get("country")
        state = country.get("name") if isinstance(country, dict) else None
        normalized: list[dict] = []
        for sensor in sensors:
            parameter = sensor.get("parameter") if isinstance(sensor, dict) else None
            if not isinstance(parameter, dict) or not _pm25_parameter(parameter.get("name")):
                continue
            sensor_id = sensor.get("id")
            if not isinstance(sensor_id, int):
                logger.warning("Skipping OpenAQ PM2.5 sensor without an id at %s", name)
                continue

            self.total_units += 1
            try:
                measurements = self._request_pages(
                    client,
                    f"/sensors/{sensor_id}/measurements",
                    {
                        "datetime_from": self._start.isoformat().replace("+00:00", "Z"),
                        "datetime_to": self._end.isoformat().replace("+00:00", "Z"),
                    },
                )
                for measurement in measurements:
                    record = self._normalize_measurement(
                        measurement, name, location.get("locality"), state, latitude, longitude
                    )
                    if record is not None:
                        normalized.append(record)
            except (httpx.HTTPError, ValueError) as exc:
                self.failed_units += 1
                detail = f"sensor {sensor_id}: {exc}"
                self.failure_details.append(detail)
                logger.warning("OpenAQ sensor %s failed: %s", sensor_id, exc)
        return normalized

    @staticmethod
    def _normalize_measurement(
        measurement: dict[str, Any],
        station: str,
        city: object,
        state: object,
        latitude: float,
        longitude: float,
    ) -> dict | None:
        parameter = measurement.get("parameter")
        period = measurement.get("period")
        if not isinstance(parameter, dict) or not _pm25_parameter(parameter.get("name")):
            return None
        if parameter.get("units") not in PM25_UNITS:
            logger.warning(
                "Skipping OpenAQ PM2.5 value with unsupported unit %r", parameter.get("units")
            )
            return None
        value = measurement.get("value")
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            logger.warning("Skipping OpenAQ PM2.5 value missing a numeric concentration")
            return None
        if not isinstance(period, dict) or not isinstance(period.get("datetimeFrom"), dict):
            logger.warning("Skipping OpenAQ PM2.5 value missing datetimeFrom")
            return None
        timestamp = period["datetimeFrom"].get("utc")
        if not isinstance(timestamp, str):
            logger.warning("Skipping OpenAQ PM2.5 value missing a UTC timestamp")
            return None
        return {
            "station": station,
            "city": city if isinstance(city, str) else None,
            "state": state if isinstance(state, str) else None,
            "latitude": latitude,
            "longitude": longitude,
            "last_update": _utc_timestamp(timestamp).isoformat().replace("+00:00", "Z"),
            "pollutant_id": "PM2.5",
            "pollutant_avg": value,
            "station_source": "OPENAQ",
        }

    def _fetch_live(self) -> list[dict]:
        self.total_units = 0
        self.failed_units = 0
        self.failure_details = []
        records: list[dict] = []
        with httpx.Client(timeout=HTTP_TIMEOUT, limits=HTTP_LIMITS) as client:
            for location in self._locations(client):
                records.extend(self._measurement_records(client, location))
        if self.total_units and self.total_units == self.failed_units:
            raise RuntimeError("all OpenAQ PM2.5 sensors failed")
        return records


def run_backfill(source: OpenAqSource, dry_run: bool = False) -> int:
    """Execute historical OpenAQ ingestion through the standard run recorder."""
    return run_source(source, write_station_readings, dry_run=dry_run)


def _parse_end(value: str) -> datetime:
    return _utc_timestamp(value)


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill historical OpenAQ v3 PM2.5 readings")
    parser.add_argument("--bbox", default=NCR_BBOX, help="min-lon,min-lat,max-lon,max-lat")
    parser.add_argument(
        "--days", type=int, default=DEFAULT_BACKFILL_DAYS, help="UTC backfill window (60-90)"
    )
    parser.add_argument("--end", type=_parse_end, help="UTC ISO-8601 end timestamp")
    parser.add_argument(
        "--latest", action="store_true", help="ingest the latest one-hour window for scheduling"
    )
    parser.add_argument("--dry-run", action="store_true", help="fetch and validate without writing")
    args = parser.parse_args()
    source = OpenAqSource(
        settings.openaq_api_key, args.bbox, args.days, args.end, latest=args.latest
    )
    count = run_backfill(source, args.dry_run)
    status = "PARTIAL" if source.is_partial else "SUCCESS"
    print(
        f"OpenAQ {source.mode}: {count} PM2.5 records; sensors attempted="
        f"{source.total_units}, failed={source.failed_units}, status={status}; from "
        f"{source.start.isoformat()} to {source.end.isoformat()}"
    )
