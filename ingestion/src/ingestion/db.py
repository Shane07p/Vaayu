"""PostGIS writers.

This module is the entire contract between Python and Java: Python writes here,
the Spring Boot service reads. Column names must match the Flyway migrations in
``backend/src/main/resources/db/migration`` exactly, and neither side changes a
table the other depends on without a migration.

Implement:
    ``write_station_readings(records, mode) -> int``
    ``write_fire_detections(records, mode) -> int``
    ``record_run(source, mode, status, row_count, error) -> None``

``record_run`` must distinguish ``SOURCE_UNAVAILABLE`` from ``FAILED``: the
first means the upstream is down, the second means our job broke, and the
console shows them differently.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from hashlib import sha256
from zoneinfo import ZoneInfo

from sqlalchemy import create_engine, text

from ingestion.settings import settings

engine = create_engine(settings.database_url, future=True)

IST = ZoneInfo("Asia/Kolkata")


def _station_code(name: str, source: str) -> str:
    digest = sha256(f"{source}:{name}".encode()).hexdigest()[:16]
    return f"{source}-{digest}"


def _as_float(value: object) -> float | None:
    if value in (None, "", "NA", "N/A"):
        return None
    return float(str(value))


def _cpcb_timestamp(value: object) -> datetime:
    if not isinstance(value, str):
        raise ValueError("CPCB reading has no timestamp")
    parsed = datetime.strptime(value, "%d-%m-%Y %H:%M:%S").replace(tzinfo=IST)
    return parsed.astimezone(ZoneInfo("UTC"))


def write_station_readings(records: list[dict], mode: str) -> int:
    """Upsert CPCB station metadata and their pollutant readings atomically."""
    grouped: dict[tuple[str, datetime], dict] = defaultdict(dict)
    for record in records:
        station_name = record.get("station")
        if not isinstance(station_name, str) or not station_name:
            raise ValueError("CPCB record has no station name")
        timestamp = _cpcb_timestamp(record.get("last_update"))
        entry = grouped[(station_name, timestamp)]
        entry.update(record)
        pollutant = str(record.get("pollutant_id", "")).upper().replace(".", "")
        if pollutant in {"PM25", "PM10", "NO2", "SO2", "CO", "O3"}:
            entry[pollutant] = _as_float(record.get("pollutant_avg"))

    with engine.begin() as connection:
        for (name, timestamp), record in grouped.items():
            latitude = _as_float(record.get("latitude"))
            longitude = _as_float(record.get("longitude"))
            if (
                latitude is None
                or longitude is None
                or not -90 <= latitude <= 90
                or not -180 <= longitude <= 180
            ):
                raise ValueError(f"CPCB record for {name!r} has invalid coordinates")
            code = _station_code(name, "CPCB")
            station_id = connection.execute(
                text(
                    """
                    INSERT INTO station (code, name, city, state, geom, source)
                    VALUES (:code, :name, :city, :state,
                            ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography,
                            :source)
                    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name,
                        city = EXCLUDED.city, state = EXCLUDED.state
                    RETURNING id
                    """
                ),
                {
                    "code": code,
                    "name": name,
                    "city": record.get("city"),
                    "state": record.get("state"),
                    "longitude": longitude,
                    "latitude": latitude,
                    "source": mode,
                },
            ).scalar_one()
            connection.execute(
                text(
                    """
                    INSERT INTO station_reading
                        (station_id, ts, pm25, pm10, no2, so2, co, o3, source)
                    VALUES (:station_id, :ts, :pm25, :pm10, :no2, :so2, :co, :o3, :source)
                    ON CONFLICT (station_id, ts, source) DO UPDATE SET
                        pm25 = EXCLUDED.pm25, pm10 = EXCLUDED.pm10, no2 = EXCLUDED.no2,
                        so2 = EXCLUDED.so2, co = EXCLUDED.co, o3 = EXCLUDED.o3,
                        ingested_at = now()
                    """
                ),
                {
                    "station_id": station_id,
                    "ts": timestamp,
                    "pm25": record.get("PM25"),
                    "pm10": record.get("PM10"),
                    "no2": record.get("NO2"),
                    "so2": record.get("SO2"),
                    "co": record.get("CO"),
                    "o3": record.get("O3"),
                    "source": mode,
                },
            )
    return len(grouped)


def write_fire_detections(records: list[dict], mode: str) -> int:
    """Write validated FIRMS CSV detections in one transaction."""
    rows = []
    for record in records:
        latitude = _as_float(record.get("latitude"))
        longitude = _as_float(record.get("longitude"))
        if (
            latitude is None
            or longitude is None
            or not -90 <= latitude <= 90
            or not -180 <= longitude <= 180
        ):
            raise ValueError("FIRMS record has invalid coordinates")
        acquired = f"{record.get('acq_date')} {str(record.get('acq_time', '0')).zfill(4)}"
        timestamp = datetime.strptime(acquired, "%Y-%m-%d %H%M").replace(
            tzinfo=ZoneInfo("UTC")
        )
        rows.append(
            {
                "external_id": f"{latitude}:{longitude}:{acquired}",
                "ts": timestamp,
                "latitude": latitude,
                "longitude": longitude,
                "frp": _as_float(record.get("frp")),
                "confidence": str(record.get("confidence") or "unknown"),
                "sensor": str(record.get("satellite") or "VIIRS_SNPP"),
                "source": mode,
            }
        )
    with engine.begin() as connection:
        for row in rows:
            connection.execute(
                text(
                    """
                    INSERT INTO fire_detection
                        (external_id, ts, geom, frp, confidence, sensor, source)
                    VALUES
                        (:external_id, :ts,
                         ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography,
                         :frp, :confidence, :sensor, :source)
                    ON CONFLICT (external_id) WHERE external_id IS NOT NULL DO UPDATE SET
                        ts = EXCLUDED.ts, geom = EXCLUDED.geom, frp = EXCLUDED.frp,
                        confidence = EXCLUDED.confidence, sensor = EXCLUDED.sensor,
                        source = EXCLUDED.source, ingested_at = now()
                    """
                ),
                row,
            )
    return len(rows)


def record_run(
    source: str,
    mode: str,
    status: str,
    row_count: int | None = None,
    error: str | None = None,
) -> None:
    """Record completion without erasing the distinction between source and job failures."""
    if status not in {"SUCCESS", "SOURCE_UNAVAILABLE", "FAILED"}:
        raise ValueError("status must be SUCCESS, SOURCE_UNAVAILABLE, or FAILED")
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                INSERT INTO ingestion_run
                    (source, mode, started_at, finished_at, status, row_count, error)
                VALUES (:source, :mode, now(), now(), :status, :row_count, :error)
                """
            ),
            {
                "source": source,
                "mode": mode,
                "status": status,
                "row_count": row_count,
                "error": error,
            },
        )
