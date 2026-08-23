"""Run the scheduled ingestion jobs locally, from the deployed definitions.

`infra/scheduler-jobs.json` is the handoff to Cloud Scheduler. Nothing executes
it outside the cloud, so on a developer machine ingestion runs only when someone
types a command, and the data ages out between runs: OpenAQ publishes with a
roughly three hour lag against a six hour freshness window, so a manual run buys
about three hours before every reading correctly reports stale and the rankings
correctly refuse to rank.

This reads the same file rather than restating the cadence. A second copy of the
schedule would drift, and the first sign of drift would be a local demo behaving
unlike the deployment it is meant to represent.

It is deliberately not a cron daemon. It supports the field syntax these jobs
actually use -- integers, `*`, and comma lists -- and refuses anything else
loudly rather than silently never firing.
"""

from __future__ import annotations

import argparse
import json
import logging
import subprocess
import time
from datetime import UTC, datetime
from pathlib import Path

logger = logging.getLogger(__name__)

# Repository root, from ingestion/src/ingestion/scheduler.py.
DEFAULT_JOBS_FILE = Path(__file__).resolve().parents[3] / "infra" / "scheduler-jobs.json"

TICK_SECONDS = 20


class UnsupportedScheduleError(ValueError):
    """A cron field this runner cannot honour.

    Raised rather than skipped. A schedule that is quietly never matched is a
    job that appears configured and never runs, which is worse than refusing to
    start.
    """


def _matches_field(field: str, value: int) -> bool:
    if field == "*":
        return True
    for part in field.split(","):
        part = part.strip()
        if not part.isdigit():
            raise UnsupportedScheduleError(
                f"unsupported cron field {field!r}: this runner handles "
                "integers, '*' and comma lists"
            )
        if int(part) == value:
            return True
    return False


def is_due(schedule: str, moment: datetime) -> bool:
    """Whether a five field cron expression matches this minute, in UTC."""
    fields = schedule.split()
    if len(fields) != 5:
        raise UnsupportedScheduleError(f"expected 5 cron fields, got {len(fields)}: {schedule!r}")

    minute, hour, day, month, weekday = fields
    return (
        _matches_field(minute, moment.minute)
        and _matches_field(hour, moment.hour)
        and _matches_field(day, moment.day)
        and _matches_field(month, moment.month)
        # cron allows 0 and 7 for Sunday; Python's weekday() has Monday as 0.
        and _matches_field(weekday, (moment.weekday() + 1) % 7)
    )


def load_jobs(path: Path) -> list[dict]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    jobs = payload.get("jobs", [])
    for job in jobs:
        # Validate every schedule before the first tick, so a malformed entry
        # fails at startup rather than at three in the morning.
        is_due(job["schedule"], datetime.now(UTC))
    return jobs


def run_job(job: dict) -> None:
    command = job.get("command") or job.get("args") or []
    if isinstance(command, str):
        command = command.split()
    if not command:
        logger.warning("Job %s has no command; skipping", job.get("name"))
        return

    logger.info("Running %s: %s", job.get("name"), " ".join(command))
    completed = subprocess.run(command, check=False)
    # Not raised. One failing job must not stop the others, and the connector
    # already records its own outcome in ingestion_run.
    logger.info("Job %s exited %s", job.get("name"), completed.returncode)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run scheduled ingestion jobs locally")
    parser.add_argument("--jobs-file", type=Path, default=DEFAULT_JOBS_FILE)
    parser.add_argument(
        "--run-now",
        action="store_true",
        help="run every job once at startup, so a fresh stack has data immediately",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")

    jobs = load_jobs(args.jobs_file)
    logger.info("Loaded %d jobs from %s", len(jobs), args.jobs_file)

    if args.run_now:
        for job in jobs:
            run_job(job)

    fired: set[tuple[str, str]] = set()
    while True:
        now = datetime.now(UTC)
        stamp = now.strftime("%Y-%m-%dT%H:%M")
        for job in jobs:
            key = (job["name"], stamp)
            if key in fired:
                continue
            if is_due(job["schedule"], now):
                fired.add(key)
                run_job(job)

        # Only this minute's firings matter; the rest is unbounded growth.
        fired = {key for key in fired if key[1] == stamp}
        time.sleep(TICK_SECONDS)


if __name__ == "__main__":
    main()
