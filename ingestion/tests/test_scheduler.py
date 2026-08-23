"""The local runner honours the deployed schedule, or refuses to start.

A cron field this runner cannot match is a job that looks configured and never
fires. That failure is silent by nature, so it is raised at load time instead.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

import pytest

from ingestion.scheduler import (
    DEFAULT_JOBS_FILE,
    UnsupportedScheduleError,
    is_due,
    load_jobs,
)


def at(hour: int, minute: int, day: int = 23, month: int = 8) -> datetime:
    return datetime(2026, month, day, hour, minute, tzinfo=UTC)


class TestScheduleMatching:
    def test_hourly_at_a_given_minute(self):
        assert is_due("5 * * * *", at(14, 5))
        assert is_due("5 * * * *", at(3, 5))
        assert not is_due("5 * * * *", at(14, 6))

    def test_daily_at_a_given_time(self):
        assert is_due("0 3 * * *", at(3, 0))
        assert not is_due("0 3 * * *", at(4, 0))
        assert not is_due("0 3 * * *", at(3, 1))

    def test_comma_lists(self):
        assert is_due("0,30 * * * *", at(9, 30))
        assert is_due("0,30 * * * *", at(9, 0))
        assert not is_due("0,30 * * * *", at(9, 15))

    def test_weekday_uses_cron_numbering_not_python(self):
        """cron counts Sunday as 0; Python's weekday() counts Monday as 0."""
        sunday = datetime(2026, 8, 23, 12, 0, tzinfo=UTC)
        assert sunday.weekday() == 6
        assert is_due("0 12 * * 0", sunday)
        assert not is_due("0 12 * * 1", sunday)


class TestUnsupportedSchedulesAreRefused:
    def test_step_syntax_is_refused_rather_than_never_matched(self):
        with pytest.raises(UnsupportedScheduleError, match="integers"):
            is_due("*/15 * * * *", at(12, 15))

    def test_range_syntax_is_refused(self):
        with pytest.raises(UnsupportedScheduleError):
            is_due("0 9-17 * * *", at(12, 0))

    def test_wrong_field_count_is_refused(self):
        with pytest.raises(UnsupportedScheduleError, match="5 cron fields"):
            is_due("0 3 * *", at(3, 0))


class TestTheDeployedDefinitionsLoad:
    def test_every_scheduled_job_is_runnable_by_this_runner(self):
        """The point of reading infra/scheduler-jobs.json is that the local and
        deployed cadences cannot drift. If a job is added with syntax this
        runner does not support, this fails rather than the job silently never
        running locally."""
        jobs = load_jobs(DEFAULT_JOBS_FILE)

        assert jobs, "no jobs defined"
        for job in jobs:
            assert job.get("command"), f"{job['name']} has no command"

    def test_the_definitions_file_is_where_the_runner_expects(self):
        assert DEFAULT_JOBS_FILE.is_file(), DEFAULT_JOBS_FILE

    def test_schedules_are_utc(self):
        """is_due compares against datetime.now(UTC), so a job declaring another
        timezone would fire at the wrong hour."""
        payload = json.loads(Path(DEFAULT_JOBS_FILE).read_text(encoding="utf-8"))
        for job in payload["jobs"]:
            assert job.get("timezone", "UTC") == "UTC", job["name"]
