"""Persist explainable station-reading holdouts after OpenAQ ingestion.

This module owns database access only. The thresholds and decision rules are in
``vaayu_ml.quality`` so manual review, ML work, and the operational collector
all use the same definition of a suspect reading.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta

from sqlalchemy import text
from vaayu_ml.quality import detect_anomalies

from ingestion.db import engine

# OpenAQ timestamps are commonly several hours behind collection. Neighbours
# may arrive in the preceding or following poll, so compare an honest ±90-minute
# window rather than pretending they were simultaneous.
NEIGHBOUR_TIME_WINDOW = timedelta(minutes=90)
NEIGHBOUR_RADIUS_METRES = 10_000


def _numbers(rows) -> list[float]:
    return [float(row[0]) for row in rows if row[0] is not None]


def scan_recent_openaq_readings(lookback: timedelta = timedelta(minutes=15)) -> int:
    """Flag clear faults among readings written by the just-finished collector.

    ``lookback`` deliberately selects on ``ingested_at``, not measurement time:
    the former identifies work this invocation actually performed, while the
    latter would miss delayed but newly-ingested observations. Re-running is
    safe because the database primary key is ``(reading_id, reason)``.
    """
    since = datetime.now(UTC) - lookback
    flagged = 0
    with engine.begin() as connection:
        candidates = connection.execute(
            text(
                """
                SELECT r.id, r.station_id, r.ts, r.pm25, s.geom
                FROM station_reading r
                JOIN station s ON s.id = r.station_id
                WHERE s.code LIKE 'OPENAQ-%'
                  AND r.pm25 IS NOT NULL
                  AND r.ingested_at >= :since
                ORDER BY r.id
                """
            ),
            {"since": since},
        ).mappings()

        for reading in candidates:
            neighbours = _numbers(
                connection.execute(
                    text(
                        """
                        SELECT other.pm25
                        FROM station_reading other
                        JOIN station neighbour ON neighbour.id = other.station_id
                        WHERE other.id <> :reading_id
                          AND other.pm25 IS NOT NULL
                          AND other.ts BETWEEN :start AND :end
                          AND ST_DWithin(neighbour.geom, :geom, :radius_metres)
                          AND NOT EXISTS (
                              SELECT 1 FROM station_reading_anomaly anomaly
                              WHERE anomaly.reading_id = other.id
                                AND anomaly.status IN ('OPEN', 'CONFIRMED')
                          )
                        """
                    ),
                    {
                        "reading_id": reading["id"],
                        "start": reading["ts"] - NEIGHBOUR_TIME_WINDOW,
                        "end": reading["ts"] + NEIGHBOUR_TIME_WINDOW,
                        "geom": reading["geom"],
                        "radius_metres": NEIGHBOUR_RADIUS_METRES,
                    },
                )
            )
            history = _numbers(
                connection.execute(
                    text(
                        """
                        SELECT pm25
                        FROM station_reading
                        WHERE station_id = :station_id
                          AND pm25 IS NOT NULL
                          AND ts <= :measured_at
                        ORDER BY ts DESC
                        LIMIT 6
                        """
                    ),
                    {"station_id": reading["station_id"], "measured_at": reading["ts"]},
                )
            )
            for candidate in detect_anomalies(float(reading["pm25"]), neighbours, history):
                result = connection.execute(
                    text(
                        """
                        INSERT INTO station_reading_anomaly (reading_id, reason, details)
                        VALUES (:reading_id, :reason, CAST(:details AS jsonb))
                        ON CONFLICT (reading_id, reason) DO UPDATE SET
                            details = EXCLUDED.details,
                            detected_at = now()
                        WHERE station_reading_anomaly.status = 'OPEN'
                        """
                    ),
                    {
                        "reading_id": reading["id"],
                        "reason": candidate.reason,
                        "details": json.dumps(candidate.details),
                    },
                )
                flagged += result.rowcount
    return flagged
