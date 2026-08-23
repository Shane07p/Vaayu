"""Tests for the CPCB client and its record shape.

CPCB is the ground truth every model trains against, so the parsing rules here
decide what "correct" means for the whole project. Two of them matter most:
timestamps are IST and must not be read as UTC, and sentinel values must not be
mistaken for readings.
"""

import json
from datetime import UTC, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

from ingestion.cpcb import BASE_URL, RESOURCE_ID, CpcbSource, run_cpcb
from ingestion.db import _as_float, _cpcb_timestamp

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"


class TestTimestampParsing:
    def test_ist_is_converted_to_utc(self):
        """data.gov.in reports DD-MM-YYYY HH:MM:SS in IST, which is UTC+5:30.

        Reading it as UTC would shift every reading five and a half hours and
        silently destroy the diurnal cycle the models depend on.
        """
        parsed = _cpcb_timestamp("19-08-2026 09:00:00")

        assert parsed.tzinfo is not None
        assert parsed == datetime(2026, 8, 19, 3, 30, tzinfo=UTC)

    def test_parsed_timestamps_are_timezone_aware(self):
        assert _cpcb_timestamp("01-01-2026 00:00:00").utcoffset() is not None

    def test_midnight_rolls_back_to_the_previous_utc_day(self):
        parsed = _cpcb_timestamp("19-08-2026 02:00:00")
        assert parsed.date().isoformat() == "2026-08-18"

    def test_ist_round_trip_preserves_the_original_wall_clock(self):
        parsed = _cpcb_timestamp("19-08-2026 09:00:00")
        assert parsed.astimezone(ZoneInfo("Asia/Kolkata")).hour == 9

    @pytest.mark.parametrize("value", ["2026-08-19 09:00:00", "19/08/2026", "", None])
    def test_malformed_timestamps_raise_rather_than_guess(self, value):
        with pytest.raises(ValueError):
            _cpcb_timestamp(value)


class TestValueParsing:
    @pytest.mark.parametrize("value", [None, "", "NA", "N/A"])
    def test_sentinel_values_become_none_not_zero(self, value):
        """A missing reading must not enter the model as a real zero."""
        assert _as_float(value) is None

    def test_numeric_strings_parse(self):
        assert _as_float("148") == 148.0
        assert _as_float("12.5") == 12.5

    def test_negative_values_parse_but_stay_visible_to_validation(self):
        """Parsing and validating are separate concerns; this only parses."""
        assert _as_float("-5") == -5.0


class TestClientShape:
    def test_resource_id_targets_the_sanctioned_endpoint(self):
        """app.cpcbccr.com is reverse-engineered and unofficial; data.gov.in is not."""
        assert f"https://api.data.gov.in/resource/{RESOURCE_ID}" == BASE_URL
        assert "cpcbccr" not in BASE_URL

    def test_missing_key_reads_the_fixture(self):
        source = CpcbSource(api_key=None)
        assert source.mode == "FIXTURE"
        assert source.fetch()

    def test_fixture_keeps_the_min_max_avg_shape_of_the_real_response(self):
        """CPCB reports three values per pollutant, not one per station.

        A fixture simplified to a single value would let a parser pass tests it
        would fail against the live feed.
        """
        for record in json.loads((FIXTURES / "cpcb_sample.json").read_text()):
            assert {"pollutant_min", "pollutant_max", "pollutant_avg"} <= set(record)
            assert {"latitude", "longitude", "last_update", "station"} <= set(record)

    def test_live_call_sends_the_api_key_and_parses_records(self, monkeypatch):
        captured = {}

        class FakeResponse:
            def raise_for_status(self) -> None:
                return None

            def json(self) -> dict:
                return {"records": [{"station": "Test", "pollutant_id": "PM2.5"}]}

        def fake_get(url, params=None, **kwargs):
            captured["url"] = url
            captured["params"] = params
            return FakeResponse()

        monkeypatch.setattr("ingestion.cpcb.httpx.get", fake_get)

        records = CpcbSource(api_key="secret").fetch()

        assert captured["params"]["api-key"] == "secret"
        assert captured["params"]["format"] == "json"
        assert len(records) == 1

    def test_response_without_a_records_list_is_an_error_not_an_empty_run(self, monkeypatch):
        """Returning [] here would record a SUCCESS with zero rows and hide an outage."""

        class FakeResponse:
            def raise_for_status(self) -> None:
                return None

            def json(self) -> dict:
                return {"message": "quota exceeded"}

        monkeypatch.setattr("ingestion.cpcb.httpx.get", lambda url, **kw: FakeResponse())

        from ingestion.source import SourceUnavailableError

        with pytest.raises(SourceUnavailableError):
            CpcbSource(api_key="secret").fetch()

    def test_cpcb_uses_the_shared_provenance_aware_runner(self, monkeypatch):
        captured = {}

        def fake_run_source(source, writer, dry_run=False):
            captured.update({"source": source, "writer": writer, "dry_run": dry_run})
            return 3

        monkeypatch.setattr("ingestion.cpcb.run_source", fake_run_source)
        source = CpcbSource(api_key="secret")

        assert run_cpcb(source, dry_run=True) == 3
        assert captured["source"] is source
        assert captured["writer"].__name__ == "write_station_readings"
        assert captured["dry_run"] is True
