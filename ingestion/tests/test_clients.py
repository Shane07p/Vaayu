import httpx
import pytest

from ingestion.cpcb import CpcbSource
from ingestion.firms import FirmsSource
from ingestion.openaq import OpenAqSource
from ingestion.openmeteo import OpenMeteoSource
from ingestion.source import SourceUnavailableError


class StubResponse:
    def __init__(self, payload: object | None = None, text: str = "") -> None:
        self._payload = payload
        self.text = text

    def raise_for_status(self) -> None:
        return None

    def json(self) -> object:
        return self._payload


def test_cpcb_live_client_unwraps_the_sanctioned_response(
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setattr(
        httpx,
        "get",
        lambda *args, **kwargs: StubResponse({"records": [{"station": "A"}]}),
    )
    assert CpcbSource("key").fetch() == [{"station": "A"}]


def test_openaq_uses_v3_results_and_does_not_call_live_without_a_key():
    fixture = OpenAqSource(None).fetch()
    assert fixture[0]["id"] == 8118


def test_firms_parses_csv_live_response(monkeypatch: pytest.MonkeyPatch):
    csv_text = "latitude,longitude,acq_date,acq_time\n31.6,74.8,2026-08-19,0836\n"
    monkeypatch.setattr(httpx, "get", lambda *args, **kwargs: StubResponse(text=csv_text))
    assert FirmsSource("key").fetch()[0]["latitude"] == "31.6"


def test_openmeteo_is_live_without_an_api_key(monkeypatch: pytest.MonkeyPatch):
    payload = {
        "hourly": {
            "time": ["2026-08-19T00:00"],
            "pm2_5": [100],
            "pm10": [160],
            "nitrogen_dioxide": [30],
            "us_aqi": [170],
        }
    }
    monkeypatch.setattr(httpx, "get", lambda *args, **kwargs: StubResponse(payload))
    source = OpenMeteoSource()
    assert source.mode == "LIVE"
    assert source.fetch()[0]["pm2_5"] == 100


def test_malformed_upstream_payload_is_source_unavailable(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(httpx, "get", lambda *args, **kwargs: StubResponse({"not_records": []}))
    with pytest.raises(SourceUnavailableError):
        CpcbSource("key").fetch()
