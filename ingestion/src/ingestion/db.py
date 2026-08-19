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

from sqlalchemy import create_engine

from ingestion.settings import settings

engine = create_engine(settings.database_url, future=True)
