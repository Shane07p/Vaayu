"""Tests for run outcome recording and the failure paths around it.

Every one of these covers a case where the pipeline previously stayed quiet
about a problem. Silence is the failure mode that matters here: a run that
records nothing looks identical to a run nobody started.
"""

import os

import pytest

from ingestion.openmeteo import OpenMeteoSource
from ingestion.runner import run_source
from ingestion.source import Source, SourceUnavailableError


class StubSource(Source):
    name = "STUB"
    fixture_file = "cpcb_sample.json"

    def _fetch_live(self) -> list[dict]:
        return [{"ok": True}]


class UnavailableSource(StubSource):
    def _fetch_live(self) -> list[dict]:
        raise RuntimeError("upstream 503")


@pytest.fixture
def recorded(monkeypatch):
    """Capture record_run calls instead of writing to the database."""
    calls = []
    monkeypatch.setattr(
        "ingestion.runner.record_run",
        lambda source, mode, status, row_count=None, error=None: calls.append(
            {"source": source, "mode": mode, "status": status, "rows": row_count}
        ),
    )
    return calls


class TestOutcomeIsAlwaysRecorded:
    def test_success_records_success_with_the_row_count(self, recorded):
        written = run_source(StubSource(api_key="k"), lambda records, mode: len(records))

        assert written == 1
        assert recorded == [{"source": "STUB", "mode": "LIVE", "status": "SUCCESS", "rows": 1}]

    def test_partial_source_records_partial_with_failure_details(self, recorded):
        source = StubSource(api_key="k")
        source.total_units = 2
        source.failed_units = 1
        source.failure_details = ["sensor 45: server error"]

        run_source(source, lambda records, mode: len(records))

        assert recorded[0]["status"] == "PARTIAL"
        assert recorded[0]["rows"] == 1

    def test_upstream_outage_records_source_unavailable_and_re_raises(self, recorded):
        """Previously this left no ingestion_run row at all."""
        with pytest.raises(SourceUnavailableError):
            run_source(UnavailableSource(api_key="k"), lambda records, mode: len(records))

        assert len(recorded) == 1
        assert recorded[0]["status"] == "SOURCE_UNAVAILABLE"

    def test_writer_crash_records_failed_not_source_unavailable(self, recorded):
        """A bug in our own code must not be reported as an upstream outage."""

        def exploding_writer(records, mode):
            raise ValueError("bad row")

        with pytest.raises(ValueError, match="bad row"):
            run_source(StubSource(api_key="k"), exploding_writer)

        assert len(recorded) == 1
        assert recorded[0]["status"] == "FAILED"

    def test_dry_run_records_nothing(self, recorded):
        count = run_source(StubSource(api_key="k"), lambda records, mode: 999, dry_run=True)

        assert count == 1
        assert recorded == []

    def test_outcome_is_recorded_exactly_once(self, recorded):
        run_source(StubSource(api_key="k"), lambda records, mode: len(records))
        assert len(recorded) == 1


class TestSnapshotRowsRefusesToDropSilently:
    """The raise happens before any database work, so no connection is needed."""

    def test_records_without_a_grid_cell_code_raise(self):
        from ingestion.db import _snapshot_rows

        records = [
            {"grid_cell_code": "SEED-GRID-0-0", "ts": "2026-08-20T00:00:00"},
            {"ts": "2026-08-20T00:00:00"},
        ]

        with pytest.raises(ValueError, match="no grid_cell_code"):
            _snapshot_rows(records, connection=None)

    def test_the_error_names_how_many_were_unlabelled(self):
        from ingestion.db import _snapshot_rows

        with pytest.raises(ValueError, match="2 of 3"):
            _snapshot_rows(
                [{"grid_cell_code": "SEED-GRID-0-0"}, {}, {"grid_cell_code": None}],
                connection=None,
            )


class TestOfflineFlagParsing:
    @pytest.mark.parametrize("value", ["1", "true", "TRUE", "True", "yes", "ON", " true "])
    def test_truthy_spellings_all_select_fixture_mode(self, value, monkeypatch):
        """TRUE used to fall through to live mode and break the offline demo."""
        monkeypatch.setitem(os.environ, "VAAYU_OFFLINE", value)
        assert OpenMeteoSource().mode == "FIXTURE"

    @pytest.mark.parametrize("value", ["", "0", "false", "no"])
    def test_falsy_spellings_stay_live(self, value, monkeypatch):
        monkeypatch.setitem(os.environ, "VAAYU_OFFLINE", value)
        assert OpenMeteoSource().mode == "LIVE"

    def test_explicit_argument_overrides_the_environment(self, monkeypatch):
        monkeypatch.setitem(os.environ, "VAAYU_OFFLINE", "1")
        assert OpenMeteoSource(offline=False).mode == "LIVE"

    def test_offline_fixture_is_the_forecast_not_station_data(self, monkeypatch):
        """fixture_file pointed at cpcb_sample.json, which would have served
        CPCB station readings as a CAMS forecast baseline."""
        monkeypatch.setitem(os.environ, "VAAYU_OFFLINE", "1")
        source = OpenMeteoSource()

        assert source.fixture_file == "openmeteo_sample.json"
        records = source.fetch()
        assert records
        assert {"time", "pm2_5", "us_aqi"} <= set(records[0])
        assert "pollutant_avg" not in records[0]
