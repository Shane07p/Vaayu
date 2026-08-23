from __future__ import annotations

from contextlib import contextmanager
from datetime import UTC, datetime

import pytest

from ingestion.db import write_cams_forecasts
from ingestion.openmeteo import OpenMeteoSource, run_openmeteo
from ingestion.source import SourceUnavailableError


def raw_record(time: str = "2026-08-19T06:00", pm25: float = 100.0) -> dict:
    return {
        "time": time,
        "pm2_5": pm25,
        "pm10": 160.0,
        "nitrogen_dioxide": 30.0,
        "us_aqi": 170,
    }


def test_source_normalizes_target_time_horizon_and_location(monkeypatch: pytest.MonkeyPatch):
    source = OpenMeteoSource(
        offline=True,
        latitude=28.6139,
        longitude=77.2090,
        issued_at=datetime(2026, 8, 19, 6, tzinfo=UTC),
    )
    monkeypatch.setattr(
        source, "_fetch_fixture", lambda: [raw_record(), raw_record("2026-08-19T12:00")]
    )

    records = source.fetch()

    assert [record["horizon_hours"] for record in records] == [0, 6]
    assert all(record["latitude"] == 28.6139 for record in records)
    assert records[1]["valid_at"] == datetime(2026, 8, 19, 12, tzinfo=UTC)


def test_fixture_contains_a_three_day_hourly_forecast():
    records = OpenMeteoSource(offline=True).fetch()

    assert len(records) == 72
    assert records[0]["horizon_hours"] == 0
    assert records[-1]["horizon_hours"] == 71


def test_openmeteo_uses_standard_runner_and_persists_records(monkeypatch: pytest.MonkeyPatch):
    source = OpenMeteoSource(
        offline=True,
        issued_at=datetime(2026, 8, 19, 6, tzinfo=UTC),
    )
    monkeypatch.setattr(source, "_fetch_fixture", lambda: [raw_record("2026-08-19T12:00")])
    written: list[dict] = []
    recorded: list[dict] = []
    monkeypatch.setattr(
        "ingestion.openmeteo.write_cams_forecasts",
        lambda records, mode: written.extend(records) or len(records),
    )
    monkeypatch.setattr(
        "ingestion.runner.record_run",
        lambda source, mode, status, row_count=None, error=None: recorded.append(
            {"status": status, "rows": row_count}
        ),
    )

    assert run_openmeteo(source) == 1
    assert written[0]["horizon_hours"] == 6
    assert recorded == [{"status": "SUCCESS", "rows": 1}]


def test_malformed_cams_record_fails_loudly(monkeypatch: pytest.MonkeyPatch):
    source = OpenMeteoSource(offline=True)
    monkeypatch.setattr(source, "_fetch_fixture", lambda: [{"time": "bad", "pm2_5": 100.0}])

    with pytest.raises(ValueError, match="ISO-8601"):
        source.fetch()


def test_empty_cams_result_is_written_as_zero_rows(monkeypatch: pytest.MonkeyPatch):
    source = OpenMeteoSource(offline=True)
    monkeypatch.setattr(source, "_fetch_fixture", lambda: [])
    recorded: list[dict] = []
    monkeypatch.setattr(
        "ingestion.runner.record_run",
        lambda source, mode, status, row_count=None, error=None: recorded.append(
            {"status": status, "rows": row_count}
        ),
    )

    assert run_openmeteo(source) == 0
    assert recorded == [{"status": "SUCCESS", "rows": 0}]


def test_writer_upserts_a_complete_cams_row(monkeypatch: pytest.MonkeyPatch):
    executed: list[tuple[object, object]] = []

    class Connection:
        def execute(self, statement, params):
            executed.append((statement, params))

    class Engine:
        @contextmanager
        def begin(self):
            yield Connection()

    monkeypatch.setattr("ingestion.db.engine", Engine())
    record = {
        "latitude": 28.6139,
        "longitude": 77.2090,
        "issued_at": datetime(2026, 8, 19, 6, tzinfo=UTC),
        "valid_at": datetime(2026, 8, 19, 12, tzinfo=UTC),
        "horizon_hours": 6,
        "pm25": 100.0,
        "aqi": 170,
    }

    assert write_cams_forecasts([record], "LIVE") == 1
    statement, rows = executed[0]
    assert "ON CONFLICT" in str(statement)
    assert rows[0]["valid_at"] == record["valid_at"]
    assert rows[0]["horizon_hours"] == 6


def test_live_http_failure_remains_source_unavailable(monkeypatch: pytest.MonkeyPatch):
    source = OpenMeteoSource(offline=False)
    monkeypatch.setattr(
        "ingestion.openmeteo.httpx.get",
        lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("upstream down")),
    )

    with pytest.raises(SourceUnavailableError, match="Not falling back to fixtures"):
        source.fetch()
