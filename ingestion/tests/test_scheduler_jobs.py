"""Machine-readable scheduler handoff remains complete and command-compatible."""

import json
from pathlib import Path

JOBS_PATH = Path(__file__).resolve().parents[2] / "infra" / "scheduler-jobs.json"
RUNNER_DOCKERFILE = Path(__file__).resolve().parents[1] / "Dockerfile"


def test_scheduler_handoff_defines_the_current_ingestion_job_set():
    payload = json.loads(JOBS_PATH.read_text(encoding="utf-8"))
    jobs = {job["name"]: job for job in payload["jobs"]}

    assert payload["runner"]["name"] == "vaayu-ingestion"
    assert payload["runner"]["build_context"] == "."
    assert payload["runner"]["working_directory"] == "/app/ingestion"
    assert "uv sync --frozen --no-dev" in RUNNER_DOCKERFILE.read_text(encoding="utf-8")
    assert set(jobs) == {
        "vaayu-openaq-latest",
        "vaayu-firms",
        "vaayu-openmeteo",
        "vaayu-gee-maiac",
        "vaayu-gee-s5p",
        "vaayu-gee-era5",
    }
    # The dedicated connector, not `vaayu-openaq --latest`. Both fetch current
    # PM2.5, but the backfill's latest mode defaults to the NCR bbox: scheduling
    # it cut national coverage from roughly 290 stations to about 40, under a
    # different source name. See docs/INGESTION_OPERATIONS.md.
    assert jobs["vaayu-openaq-latest"]["command"][3] == "vaayu-openaq-latest"
    assert jobs["vaayu-openaq-latest"]["command"][-2:] == ["--max-stations", "300"]
    assert jobs["vaayu-firms"]["command"][-2:] == ["--days", "1"]
    assert jobs["vaayu-gee-era5"]["command"][-4:] == ["--kind", "REANALYSIS", "--hours-back", "24"]


def test_scheduler_jobs_include_operational_requirements_and_dependency_order():
    jobs = json.loads(JOBS_PATH.read_text(encoding="utf-8"))["jobs"]

    for job in jobs:
        assert job["timezone"] == "UTC"
        assert job["schedule"]
        assert job["command"][:3] == ["uv", "run", "--no-sync"]
        assert job["environment"]
        assert job["secrets"]
        assert job["timeout_seconds"] > 0
        assert job["retry"]["max_attempts"] >= 1

    by_name = {job["name"]: job for job in jobs}
    assert by_name["vaayu-gee-s5p"]["depends_on"] == ["vaayu-gee-maiac"]
    assert by_name["vaayu-gee-era5"]["depends_on"] == ["vaayu-gee-s5p"]
