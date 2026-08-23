"""Every connector that writes must also record the run.

``runner.run_source`` exists so an outcome is recorded exactly once, including
the failure paths. It was applied to OpenAQ and the Earth Engine connectors but
not to CPCB or FIRMS, which called their writers directly. Those two therefore
wrote rows without leaving an ``ingestion_run`` row, and on failure left no
trace at all -- so "the upstream is down" and "nobody ran it" looked identical
to anything reading the table.

These tests pin the wiring rather than the writers, which are covered
elsewhere.
"""

from __future__ import annotations

import pytest

from ingestion import cpcb, firms
from ingestion.source import SourceUnavailableError


class RunRecorder:
    """Stands in for ``db.record_run`` and remembers what it was told."""

    def __init__(self) -> None:
        self.calls: list[tuple] = []

    def __call__(self, source, mode, status, row_count=None, error=None) -> None:
        self.calls.append((source, mode, status, row_count, error))


@pytest.fixture
def recorder(monkeypatch: pytest.MonkeyPatch) -> RunRecorder:
    recorder = RunRecorder()
    monkeypatch.setattr("ingestion.runner.record_run", recorder)
    return recorder


class TestCpcbRecordsItsRun:
    def test_successful_ingest_records_success_with_the_row_count(
        self, monkeypatch: pytest.MonkeyPatch, recorder: RunRecorder
    ):
        monkeypatch.setattr(cpcb.CpcbSource, "fetch", lambda self: [{"station": "X"}])
        monkeypatch.setattr(cpcb.CpcbSource, "mode", "LIVE")
        monkeypatch.setattr(cpcb, "write_station_readings", lambda records, mode: 7)
        monkeypatch.setattr("sys.argv", ["vaayu-cpcb"])

        cpcb.main()

        assert recorder.calls == [("CPCB", "LIVE", "SUCCESS", 7, None)]

    def test_upstream_outage_is_recorded_as_source_unavailable(
        self, monkeypatch: pytest.MonkeyPatch, recorder: RunRecorder
    ):
        def unavailable(self):
            raise SourceUnavailableError("CPCB: upstream call failed")

        monkeypatch.setattr(cpcb.CpcbSource, "fetch", unavailable)
        monkeypatch.setattr(cpcb.CpcbSource, "mode", "LIVE")
        monkeypatch.setattr("sys.argv", ["vaayu-cpcb"])

        with pytest.raises(SourceUnavailableError):
            cpcb.main()

        source, mode, status, _, _ = recorder.calls[0]
        assert (source, mode, status) == ("CPCB", "LIVE", "SOURCE_UNAVAILABLE")

    def test_a_dry_run_writes_nothing_and_records_nothing(
        self, monkeypatch: pytest.MonkeyPatch, recorder: RunRecorder
    ):
        written: list[int] = []
        monkeypatch.setattr(cpcb.CpcbSource, "fetch", lambda self: [{"station": "X"}])
        monkeypatch.setattr(cpcb.CpcbSource, "mode", "LIVE")
        monkeypatch.setattr(cpcb, "write_station_readings", lambda records, mode: written.append(1))
        monkeypatch.setattr("sys.argv", ["vaayu-cpcb", "--dry-run"])

        cpcb.main()

        assert written == []
        assert recorder.calls == []


class TestFirmsRecordsItsRun:
    def test_successful_ingest_records_success_with_the_row_count(
        self, monkeypatch: pytest.MonkeyPatch, recorder: RunRecorder
    ):
        monkeypatch.setattr(firms.FirmsSource, "fetch", lambda self: [{"latitude": 30.0}])
        monkeypatch.setattr(firms.FirmsSource, "mode", "LIVE")
        monkeypatch.setattr(firms, "write_fire_detections", lambda records, mode: 3)
        monkeypatch.setattr("sys.argv", ["vaayu-firms"])

        firms.main()

        assert recorder.calls == [("FIRMS", "LIVE", "SUCCESS", 3, None)]

    def test_a_writer_crash_is_recorded_as_failed_not_as_an_outage(
        self, monkeypatch: pytest.MonkeyPatch, recorder: RunRecorder
    ):
        """Our own bug must not be reported as the upstream being down."""

        def explode(records, mode):
            raise ValueError("bad geometry")

        monkeypatch.setattr(firms.FirmsSource, "fetch", lambda self: [{"latitude": 30.0}])
        monkeypatch.setattr(firms.FirmsSource, "mode", "LIVE")
        monkeypatch.setattr(firms, "write_fire_detections", explode)
        monkeypatch.setattr("sys.argv", ["vaayu-firms"])

        with pytest.raises(ValueError):
            firms.main()

        source, _, status, _, _ = recorder.calls[0]
        assert (source, status) == ("FIRMS", "FAILED")
