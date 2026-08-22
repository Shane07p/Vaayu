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
from ingestion.source import SourceUnavailableError


class FakeResponse:
    def __init__(self, payload: object) -> None:
        self._payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self) -> object:
        return self._payload


def measurement(value: float = 82.1, units: str = "µg/m³") -> dict:
    return {
        "value": value,
        "parameter": {"name": "pm25", "units": units},
        "period": {"datetimeFrom": {"utc": "2026-08-19T00:00:00Z"}},
    }


def location() -> dict:
    return {
        "id": 8118,
        "name": "New Delhi US Embassy",
        "locality": "New Delhi",
        "country": {"name": "India"},
        "coordinates": {"latitude": 28.5921, "longitude": 77.2279},
        "sensors": [{"id": 44, "parameter": {"name": "pm25"}}],
    }


def test_live_backfill_uses_v3_sensor_measurements_and_required_headers(monkeypatch):
    calls: list[tuple[str, dict, dict]] = []

    def fake_get(url, params, headers, timeout):
        calls.append((url, params, headers))
        if url == f"{BASE_URL}/locations":
            return FakeResponse(
                {"meta": {"page": 1, "limit": 1000, "found": 1}, "results": [location()]}
            )
        return FakeResponse(
            {"meta": {"page": 1, "limit": 1000, "found": 1}, "results": [measurement()]}
        )

    monkeypatch.setattr("ingestion.openaq.httpx.get", fake_get)
    source = OpenAqSource("test-key", end=datetime(2026, 8, 19, tzinfo=UTC))

    records = source.fetch()

    assert calls[0][0] == f"{BASE_URL}/locations"
    assert calls[0][1]["bbox"] == NCR_BBOX
    assert calls[1][0] == f"{BASE_URL}/sensors/44/measurements"
    assert calls[1][1]["datetime_from"] == "2026-05-21T00:00:00Z"
    assert calls[1][1]["datetime_to"] == "2026-08-19T00:00:00Z"
    assert all(headers == {"X-API-Key": "test-key"} for _, _, headers in calls)
    assert records[0]["pollutant_avg"] == 82.1
    assert records[0]["last_update"] == "2026-08-19T00:00:00Z"
    assert records[0]["station_source"] == "OPENAQ"


def test_pagination_fetches_every_page_and_stops_at_found_count(monkeypatch):
    pages: list[int] = []

    def fake_get(url, params, headers, timeout):
        pages.append(params["page"])
        return FakeResponse(
            {
                "meta": {"page": params["page"], "limit": 1000, "found": 2000},
                "results": [{"id": params["page"]}] * 1000,
            }
        )

    monkeypatch.setattr("ingestion.openaq.httpx.get", fake_get)

    records = OpenAqSource("test-key")._request_pages("/sensors/44/measurements", {})

    assert pages == [1, 2]
    assert len(records) == 2000


def test_empty_page_ends_pagination_when_total_is_unknown(monkeypatch):
    pages: list[int] = []

    def fake_get(url, params, headers, timeout):
        pages.append(params["page"])
        return FakeResponse({"meta": {"page": params["page"]}, "results": []})

    monkeypatch.setattr("ingestion.openaq.httpx.get", fake_get)

    assert OpenAqSource("test-key")._request_pages("/locations", {}) == []
    assert pages == [1]


def test_http_timeout_and_failure_are_source_unavailable(monkeypatch):
    monkeypatch.setattr(
        "ingestion.openaq.httpx.get",
        lambda *args, **kwargs: (_ for _ in ()).throw(httpx.TimeoutException("slow")),
    )
    with pytest.raises(SourceUnavailableError):
        OpenAqSource("test-key").fetch()

    request = httpx.Request("GET", f"{BASE_URL}/locations")
    response = httpx.Response(500, request=request)
    monkeypatch.setattr(
        "ingestion.openaq.httpx.get",
        lambda *args, **kwargs: (_ for _ in ()).throw(
            httpx.HTTPStatusError("failed", request=request, response=response)
        ),
    )
    with pytest.raises(SourceUnavailableError):
        OpenAqSource("test-key").fetch()


def test_malformed_payload_is_source_unavailable(monkeypatch):
    monkeypatch.setattr(
        "ingestion.openaq.httpx.get", lambda *args, **kwargs: FakeResponse({"meta": {}})
    )

    with pytest.raises(SourceUnavailableError):
        OpenAqSource("test-key").fetch()


def test_malformed_measurements_are_skipped_and_units_are_not_converted():
    source = OpenAqSource("test-key")

    assert (
        source._normalize_measurement(measurement(units="mg/m³"), "Station", None, None, 1, 1)
        is None
    )
    assert source._normalize_measurement({"value": 1}, "Station", None, None, 1, 1) is None
    assert source._normalize_measurement(measurement(), "Station", "City", "India", 1, 2) == {
        "station": "Station",
        "city": "City",
        "state": "India",
        "latitude": 1,
        "longitude": 2,
        "last_update": "2026-08-19T00:00:00Z",
        "pollutant_id": "PM2.5",
        "pollutant_avg": 82.1,
        "station_source": "OPENAQ",
    }


def test_backfill_uses_the_standard_runner_and_station_writer(monkeypatch):
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
