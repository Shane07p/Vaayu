"""Open-Meteo CAMS-based air quality forecast.

This is the baseline the forecast model must beat, not a training source. A
model that does not beat it is reported as not beating it.

No API key is required for non-commercial use, so this source is always live.

Implement: ``OpenMeteoSource(Source)`` overriding the key requirement.
"""

from __future__ import annotations

import argparse
import os

import httpx

from ingestion.source import Source

BASE_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"

DELHI_LAT = 28.6139
DELHI_LON = 77.2090


class OpenMeteoSource(Source):
    """CAMS forecast baseline.

    Open-Meteo needs no API key, so this source runs live by default. It still
    supports fixture mode, because the offline demo has to produce a baseline:
    a forecast chart without the baseline it must beat is the exact failure the
    technical document warns against, and "the network was down" is not an
    excuse the chart can make on its own.

    Set ``offline=True`` (or ``VAAYU_OFFLINE=1``) to read the committed fixture.
    """

    name = "OPEN_METEO"
    fixture_file = "openmeteo_sample.json"

    def __init__(
        self,
        latitude: float = DELHI_LAT,
        longitude: float = DELHI_LON,
        offline: bool | None = None,
    ) -> None:
        if offline is None:
            offline = os.environ.get("VAAYU_OFFLINE", "").strip() in {"1", "true", "True"}
        super().__init__(api_key=None if offline else "live")
        if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
            raise ValueError("latitude or longitude is invalid")
        self._latitude = latitude
        self._longitude = longitude

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
        columns = (hourly.get(key, []) for key in keys)
        return [dict(zip(keys, values, strict=True)) for values in zip(*columns, strict=True)]


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch the Open-Meteo CAMS baseline")
    parser.add_argument("--latitude", type=float, default=DELHI_LAT)
    parser.add_argument("--longitude", type=float, default=DELHI_LON)
    args = parser.parse_args()
    source = OpenMeteoSource(args.latitude, args.longitude)
    print(f"Open-Meteo {source.mode}: {len(source.fetch())} hourly baseline records")
