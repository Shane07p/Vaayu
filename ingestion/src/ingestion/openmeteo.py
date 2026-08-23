"""Open-Meteo CAMS forecast baseline ingestion."""

from __future__ import annotations

import argparse
import math
import os
from datetime import UTC, datetime

import httpx

from ingestion.db import write_cams_forecasts
from ingestion.runner import run_source
from ingestion.source import Source

BASE_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
DELHI_LAT = 28.6139
DELHI_LON = 77.2090


def _utc_timestamp(value: object) -> datetime:
    if not isinstance(value, str):
        raise ValueError("Open-Meteo forecast has no target timestamp")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("Open-Meteo forecast timestamp must be ISO-8601") from exc
    return parsed.replace(tzinfo=UTC) if parsed.tzinfo is None else parsed.astimezone(UTC)


class OpenMeteoSource(Source):
    """CAMS forecast baseline for the configured receptor coordinate."""

    name = "OPEN_METEO"
    fixture_file = "openmeteo_sample.json"

    def __init__(
        self,
        latitude: float = DELHI_LAT,
        longitude: float = DELHI_LON,
        offline: bool | None = None,
        issued_at: datetime | None = None,
    ) -> None:
        if offline is None:
            offline = os.environ.get("VAAYU_OFFLINE", "").strip().casefold() in {
                "1",
                "true",
                "yes",
                "on",
            }
        super().__init__(api_key=None if offline else "live")
        if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
            raise ValueError("latitude or longitude is invalid")
        if issued_at is not None and issued_at.tzinfo is None:
            raise ValueError("Open-Meteo issue timestamp must include a timezone")
        self._latitude = latitude
        self._longitude = longitude
        self._issued_at = issued_at.astimezone(UTC) if issued_at else None

    def fetch(self) -> list[dict]:
        records = super().fetch()
        return self._normalize_records(records)

    def _fetch_live(self) -> list[dict]:
        response = httpx.get(
            BASE_URL,
            params={
                "latitude": self._latitude,
                "longitude": self._longitude,
                "hourly": "pm2_5,pm10,nitrogen_dioxide,us_aqi",
                "forecast_days": 3,
                "timezone": "UTC",
            },
            timeout=30.0,
        )
        response.raise_for_status()
        payload = response.json()
        hourly = payload.get("hourly")
        if not isinstance(hourly, dict) or not isinstance(hourly.get("time"), list):
            raise ValueError("Open-Meteo response did not contain hourly data")
        keys = ("time", "pm2_5", "pm10", "nitrogen_dioxide", "us_aqi")
        columns = [hourly.get(key) for key in keys]
        if not all(isinstance(column, list) for column in columns):
            raise ValueError("Open-Meteo response has a missing hourly column")
        if len({len(column) for column in columns}) != 1:
            raise ValueError("Open-Meteo response hourly columns have different lengths")
        return [dict(zip(keys, values, strict=True)) for values in zip(*columns, strict=True)]

    def _normalize_records(self, records: list[dict]) -> list[dict]:
        if not records:
            return []

        target_times = [_utc_timestamp(record.get("time")) for record in records]
        issued_at = self._issued_at or min(target_times)
        normalized: list[dict] = []
        for record, valid_at in zip(records, target_times, strict=True):
            horizon = (valid_at - issued_at).total_seconds() / 3600
            if horizon < 0 or not horizon.is_integer():
                raise ValueError(
                    "Open-Meteo forecast target is before or not aligned to its issue time"
                )
            pm25 = record.get("pm2_5")
            if (
                not isinstance(pm25, (int, float))
                or isinstance(pm25, bool)
                or not math.isfinite(pm25)
                or pm25 < 0
            ):
                raise ValueError("Open-Meteo forecast has an invalid PM2.5 value")
            aqi = record.get("us_aqi")
            if aqi is not None and (
                not isinstance(aqi, (int, float))
                or isinstance(aqi, bool)
                or aqi < 0
                or not math.isfinite(aqi)
            ):
                raise ValueError("Open-Meteo forecast has an invalid AQI value")
            normalized.append(
                {
                    "latitude": self._latitude,
                    "longitude": self._longitude,
                    "issued_at": issued_at,
                    "valid_at": valid_at,
                    "horizon_hours": int(horizon),
                    "pm25": float(pm25),
                    "aqi": int(aqi) if aqi is not None else None,
                }
            )
        return normalized


def run_openmeteo(source: OpenMeteoSource, dry_run: bool = False) -> int:
    """Execute CAMS ingestion through the shared provenance-aware runner."""
    return run_source(source, write_cams_forecasts, dry_run=dry_run)


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest the Open-Meteo CAMS baseline")
    parser.add_argument("--latitude", type=float, default=DELHI_LAT)
    parser.add_argument("--longitude", type=float, default=DELHI_LON)
    parser.add_argument("--offline", action="store_true", help="read the committed fixture")
    parser.add_argument("--dry-run", action="store_true", help="fetch and validate without writing")
    args = parser.parse_args()
    source = OpenMeteoSource(args.latitude, args.longitude, offline=args.offline)
    count = run_openmeteo(source, dry_run=args.dry_run)
    print(f"Open-Meteo {source.mode}: records={count}, status=SUCCESS")
