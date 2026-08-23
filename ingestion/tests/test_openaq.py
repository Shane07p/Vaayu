from datetime import UTC, datetime, timedelta

import httpx
import pytest

from ingestion.openaq import (
    BASE_URL,
    DEFAULT_BACKFILL_DAYS,
    NCR_BBOX,
    OpenAqSource,
    _utc_timestamp,
    run_backfill,
)
from ingestion.runner import run_source
from ingestion.source import SourceUnavailableError


class FakeResponse:
    def __init__(self, payload: object) -> None:
        self._payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self) -> object:
        return self._payload


class FakeClient:
    instances: list["FakeClient"] = []

    def __init__(self, handler, **kwargs) -> None:
        self.handler = handler
        self.kwargs = kwargs
        self.calls: list[tuple[str, dict, dict]] = []
        self.closed = False
        self.instances.append(self)

    def __enter__(self):
        return self

    def __exit__(self, *args) -> None:
        self.closed = True

    def get(self, url: str, params: dict, headers: dict) -> FakeResponse:
        self.calls.append((url, params, headers))
        return self.handler(url, params, headers)


def measurement(value: float = 82.1, units: str = "µg/m³") -> dict:
    return {
        "value": value,
        "parameter": {"name": "pm25", "units": units},
        "period": {"datetimeFrom": {"utc": "2026-08-19T00:00:00Z"}},
    }


def location(sensor_ids: list[int] | None = None) -> dict:
    return {
        "id": 8118,
        "name": "New Delhi US Embassy",
        "locality": "New Delhi",
        "country": {"name": "India"},
        "coordinates": {"latitude": 28.5921, "longitude": 77.2279},
        "sensors": [
            {"id": sensor_id, "parameter": {"name": "pm25"}}
            for sensor_id in (sensor_ids or [44])
        ],
    }


def page(results: list[dict], requested_page: int = 1) -> FakeResponse:
    return FakeResponse(
        {"meta": {"page": requested_page, "limit": 1000, "found": len(results)}, "results": results}
    )


def install_client(monkeypatch: pytest.MonkeyPatch, handler) -> None:
    FakeClient.instances = []
    monkeypatch.setattr(
        "ingestion.openaq.httpx.Client", lambda **kwargs: FakeClient(handler, **kwargs)
    )


def test_live_backfill_reuses_one_v3_client_and_required_headers(monkeypatch: pytest.MonkeyPatch):
    def handler(url, params, headers):
        if url == f"{BASE_URL}/locations":
            return page([location()])
        return page([measurement()])

    install_client(monkeypatch, handler)
    source = OpenAqSource("test-key", end=datetime(2026, 8, 19, tzinfo=UTC))

    records = source.fetch()

    assert len(FakeClient.instances) == 1
    client = FakeClient.instances[0]
    assert client.closed
    assert client.calls[0][0] == f"{BASE_URL}/locations"
    assert client.calls[0][1]["bbox"] == NCR_BBOX
    assert client.calls[1][0] == f"{BASE_URL}/sensors/44/measurements"
    assert client.calls[1][1]["datetime_from"] == "2026-05-21T00:00:00Z"
    assert client.calls[1][1]["datetime_to"] == "2026-08-19T00:00:00Z"
    assert all(headers == {"X-API-Key": "test-key"} for _, _, headers in client.calls)
    assert records[0]["pollutant_avg"] == 82.1
    assert source.total_units == 1
    assert source.failed_units == 0


def test_partial_sensor_failure_preserves_successful_records_and_provenance(
    monkeypatch: pytest.MonkeyPatch,
):
    def handler(url, params, headers):
        if url == f"{BASE_URL}/locations":
            return page([location([44, 45])])
        if url.endswith("/44/measurements"):
            return page([measurement()])
        request = httpx.Request("GET", url)
        response = httpx.Response(500, request=request)
        raise httpx.HTTPStatusError("server error", request=request, response=response)

    install_client(monkeypatch, handler)
    recorded: list[dict] = []
    persisted: list[dict] = []
    monkeypatch.setattr(
        "ingestion.runner.record_run",
        lambda source, mode, status, row_count=None, error=None: recorded.append(
            {"status": status, "rows": row_count, "error": error}
        ),
    )
    source = OpenAqSource("test-key")

    written = run_source(source, lambda records, mode: persisted.extend(records) or len(records))

    assert written == 1
    assert len(persisted) == 1
    assert source.total_units == 2
    assert source.failed_units == 1
    assert source.is_partial
    assert recorded == [{"status": "PARTIAL", "rows": 1, "error": "sensor 45: server error"}]


def test_multiple_sensor_and_parsing_failures_are_isolated(monkeypatch: pytest.MonkeyPatch):
    def handler(url, params, headers):
        if url == f"{BASE_URL}/locations":
            return page([location([44, 45, 46])])
        if url.endswith("/44/measurements"):
            return page([measurement()])
        if url.endswith("/45/measurements"):
            return page([measurement() | {"period": {"datetimeFrom": {"utc": "not-a-time"}})])
        raise httpx.TimeoutException("timed out")

    install_client(monkeypatch, handler)
    source = OpenAqSource("test-key")

    records = source.fetch()

    assert len(records) == 1
    assert source.total_units == 3
    assert source.failed_units == 2
    assert any(detail.startswith("sensor 45:") for detail in source.failure_details)
    assert any(detail == "sensor 46: timed out" for detail in source.failure_details)


def test_all_sensor_failures_are_recorded_as_source_unavailable(monkeypatch: pytest.MonkeyPatch):
    def handler(url, params, headers):
        if url == f"{BASE_URL}/locations":
            return page([location([44, 45])])
        raise httpx.TimeoutException("timed out")

    install_client(monkeypatch, handler)
    recorded: list[str] = []
    monkeypatch.setattr(
        "ingestion.runner.record_run",
        lambda source, mode, status, row_count=None, error=None: recorded.append(status),
    )

    with pytest.raises(SourceUnavailableError, match="all OpenAQ PM2.5 sensors failed"):
        run_source(OpenAqSource("test-key"), lambda records, mode: len(records))

    assert recorded == ["SOURCE_UNAVAILABLE"]


def test_pagination_fetches_every_page_and_stops_at_found_count(monkeypatch: pytest.MonkeyPatch):
    requested_pages: list[int] = []

    def handler(url, params, headers):
        requested_pages.append(params["page"])
        return FakeResponse(
            {
                "meta": {"page": params["page"], "limit": 1000, "found": 2000},
                "results": [{"id": params["page"]}] * 1000,
            }
        )

    install_client(monkeypatch, handler)
    with httpx.Client() as client:
        records = OpenAqSource("test-key")._request_pages(client, "/sensors/44/measurements", {})

    assert requested_pages == [1, 2]
    assert len(records) == 2000


def test_backfill_uses_the_standard_runner_and_station_writer(monkeypatch: pytest.MonkeyPatch):
    captured = {}

    def fake_run_source(source, writer, dry_run=False):
        captured.update({"source": source, "writer": writer, "dry_run": dry_run})
        return 7

    monkeypatch.setattr("ingestion.openaq.run_source", fake_run_source)
    source = OpenAqSource("test-key")

    assert run_backfill(source, dry_run=True) == 7
    assert captured["source"] is source
    assert captured["writer"].__name__ == "write_station_readings"
    assert captured["dry_run"] is True


def test_backfill_window_is_utc_aware_and_constrained():
    source = OpenAqSource(
        "test-key", days=DEFAULT_BACKFILL_DAYS, end=datetime(2026, 8, 19, tzinfo=UTC)
    )

    assert source.end - source.start == timedelta(days=DEFAULT_BACKFILL_DAYS)
    assert source.start == datetime(2026, 5, 21, tzinfo=UTC)
    assert _utc_timestamp("2026-08-19T05:30:00+05:30") == datetime(2026, 8, 19, tzinfo=UTC)
    with pytest.raises(ValueError):
        OpenAqSource("test-key", days=59)
    with pytest.raises(ValueError):
        _utc_timestamp("2026-08-19T00:00:00")


def test_latest_window_is_one_hour_without_relaxing_backfill_limits():
    source = OpenAqSource(
        "test-key", end=datetime(2026, 8, 19, 12, tzinfo=UTC), latest=True
    )

    assert source.start == datetime(2026, 8, 19, 11, tzinfo=UTC)
