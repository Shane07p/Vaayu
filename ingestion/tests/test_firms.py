"""Tests for the FIRMS active-fire client.

The confidence filter is not cosmetic. Detection counts feed cluster impact
scores, which feed the enforcement worklist that tells a district magistrate
where to send an officer. Admitting gas flares and hot roofs as crop fires
sends someone to the wrong village.
"""

import json
from pathlib import Path

import pytest

from ingestion.firms import (
    ACCEPTED_CONFIDENCE,
    BASE_URL,
    CORRIDOR_BBOX,
    MODIS_CONFIDENCE_FLOOR,
    SENSOR,
    FirmsSource,
    accepts_confidence,
)
from ingestion.source import SourceUnavailableError

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"


class TestConfidenceFilter:
    @pytest.mark.parametrize("value", sorted(ACCEPTED_CONFIDENCE))
    def test_high_and_nominal_are_accepted(self, value):
        assert accepts_confidence(value)

    def test_low_confidence_is_rejected(self):
        assert not accepts_confidence("l")

    def test_case_and_whitespace_do_not_change_the_verdict(self):
        assert accepts_confidence(" H ")
        assert not accepts_confidence(" L ")

    def test_missing_confidence_is_rejected_rather_than_assumed_good(self):
        assert not accepts_confidence(None)
        assert not accepts_confidence("")
        assert not accepts_confidence("   ")

    def test_modis_integer_scale_is_honoured(self):
        """MODIS reports 0-100 instead of a letter."""
        assert accepts_confidence(str(MODIS_CONFIDENCE_FLOOR))
        assert accepts_confidence("95")
        assert not accepts_confidence("12")

    def test_unparseable_confidence_is_rejected(self):
        assert not accepts_confidence("probably")


class TestFetchFiltering:
    def test_fixture_fetch_drops_low_confidence_rows(self):
        raw = json.loads((FIXTURES / "firms_sample.json").read_text())
        low = [r for r in raw if r["confidence"] == "l"]
        assert low, "fixture must contain low-confidence rows or this tests nothing"

        fetched = FirmsSource(api_key=None).fetch()

        assert len(fetched) == len(raw) - len(low)
        assert all(r["confidence"] in ACCEPTED_CONFIDENCE for r in fetched)

    def test_fixture_has_the_fifty_detections_the_plan_specifies(self):
        raw = json.loads((FIXTURES / "firms_sample.json").read_text())
        assert len(raw) == 50

    def test_detections_carry_the_fields_the_writer_needs(self):
        for record in FirmsSource(api_key=None).fetch():
            assert {"latitude", "longitude", "acq_date", "acq_time", "frp"} <= set(record)

    def test_detections_fall_inside_the_corridor(self):
        min_lon, min_lat, max_lon, max_lat = (float(v) for v in CORRIDOR_BBOX.split(","))
        for record in FirmsSource(api_key=None).fetch():
            assert min_lat <= float(record["latitude"]) <= max_lat
            assert min_lon <= float(record["longitude"]) <= max_lon


class TestLiveRequestShape:
    def test_url_places_coordinates_before_day_range(self, monkeypatch):
        """FIRMS format is area/csv/[KEY]/[SOURCE]/[AREA]/[DAY_RANGE].

        An earlier revision sent "world" in the area slot and the bbox where
        the optional date goes, which silently requested global detections and
        ignored the corridor entirely.
        """
        captured = {}

        class FakeResponse:
            text = "latitude,longitude,confidence\n31.6,74.8,h\n"

            def raise_for_status(self) -> None:
                return None

        def fake_get(url, **kwargs):
            captured["url"] = url
            return FakeResponse()

        monkeypatch.setattr("ingestion.firms.httpx.get", fake_get)

        FirmsSource(api_key="test-key", days=3).fetch()

        assert captured["url"] == f"{BASE_URL}/test-key/{SENSOR}/{CORRIDOR_BBOX}/3"
        assert "world" not in captured["url"]

    def test_live_results_are_also_confidence_filtered(self, monkeypatch):
        """Fixture and live records must pass through identical rules."""

        class FakeResponse:
            text = "latitude,longitude,confidence\n31.6,74.8,h\n31.7,74.9,l\n31.8,75.0,n\n"

            def raise_for_status(self) -> None:
                return None

        monkeypatch.setattr("ingestion.firms.httpx.get", lambda url, **kw: FakeResponse())

        records = FirmsSource(api_key="test-key").fetch()

        assert len(records) == 2
        assert all(r["confidence"] != "l" for r in records)

    @pytest.mark.parametrize("days", [0, 11, -1])
    def test_day_range_outside_the_api_limit_is_rejected(self, days):
        with pytest.raises(ValueError, match="between 1 and 10"):
            FirmsSource(api_key=None, days=days)


class TestOutageIsNotMistakenForQuiet:
    def test_response_without_a_confidence_column_raises(self, monkeypatch):
        """A schema change or an error page is not "no fires today".

        The confidence filter drops every row when the column is absent, so
        without this guard the run records a zero-row SUCCESS and the console
        shows an empty, healthy-looking fire map during an outage.
        """

        class FakeResponse:
            text = "latitude,longitude,frp\n31.6,74.8,12.5\n31.7,74.9,8.0\n"

            def raise_for_status(self) -> None:
                return None

        monkeypatch.setattr("ingestion.firms.httpx.get", lambda url, **kw: FakeResponse())

        with pytest.raises(SourceUnavailableError, match="no confidence column"):
            FirmsSource(api_key="test-key").fetch()

    def test_genuinely_empty_response_is_still_allowed(self, monkeypatch):
        """A real day with no detections must not raise."""

        class FakeResponse:
            text = "latitude,longitude,confidence\n"

            def raise_for_status(self) -> None:
                return None

        monkeypatch.setattr("ingestion.firms.httpx.get", lambda url, **kw: FakeResponse())

        assert FirmsSource(api_key="test-key").fetch() == []
