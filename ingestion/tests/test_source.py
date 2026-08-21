"""Tests for the fixture/live mode switch.

The third test is the one that matters most. Falling back to fixtures when a
live call fails would present cached values as fresh telemetry, which is the
failure mode this project most wants to avoid. It must be impossible, not
merely discouraged.
"""

import pytest

from ingestion.source import Source, SourceUnavailableError


class FakeSource(Source):
    name = "fake"
    fixture_file = "cpcb_sample.json"

    def _fetch_live(self) -> list[dict]:
        return [{"from": "live"}]


class FailingSource(FakeSource):
    def _fetch_live(self) -> list[dict]:
        raise RuntimeError("upstream 503")


def test_missing_key_selects_fixture_mode():
    source = FakeSource(api_key=None)

    assert source.mode == "FIXTURE"
    records = source.fetch()
    assert len(records) == 3
    assert records[0]["station"] == "Anand Vihar, Delhi - DPCC"


def test_blank_key_is_treated_as_absent():
    """An empty .env entry means fixture mode, not a live call with no key."""
    assert FakeSource(api_key="").mode == "FIXTURE"


def test_present_key_selects_live_mode():
    source = FakeSource(api_key="a-key")

    assert source.mode == "LIVE"
    assert source.fetch() == [{"from": "live"}]


def test_live_failure_raises_and_never_falls_back_to_fixtures():
    source = FailingSource(api_key="a-key")

    with pytest.raises(SourceUnavailableError) as excinfo:
        source.fetch()

    message = str(excinfo.value)
    assert "fake" in message
    assert "Not falling back to fixtures" in message


def test_live_failure_preserves_the_underlying_cause():
    """The original exception stays chained so the real error is not lost."""
    source = FailingSource(api_key="a-key")

    with pytest.raises(SourceUnavailableError) as excinfo:
        source.fetch()

    assert isinstance(excinfo.value.__cause__, RuntimeError)
    assert "upstream 503" in str(excinfo.value.__cause__)


def test_fixture_payload_shape_matches_the_cpcb_response():
    """data.gov.in reports min/max/avg per pollutant, not one value per station.

    Guards against a fixture being simplified into a shape the live parser
    would never see.
    """
    records = FakeSource(api_key=None).fetch()

    for record in records:
        assert {"pollutant_id", "pollutant_min", "pollutant_max", "pollutant_avg"} <= set(record)
        assert {"latitude", "longitude", "last_update"} <= set(record)
