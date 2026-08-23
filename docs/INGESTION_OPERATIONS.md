# Ingestion Operations

## CPCB investigation — 2026-08-23

The connector targets CPCB's sanctioned data.gov.in real-time AQI resource:
3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69, using `api-key`, `format=json`, and
`limit`. The official catalog still lists it as an hourly CPCB resource and
shows a 2026 update. On 2026-08-23 its endpoint returned HTTP 400 in 0.76
seconds without a key (`Authorization field missing`), confirming that the
route is live and an API key is required rather than the resource ID being stale.

A credentialed request could not be run in this environment because no
`DATA_GOV_IN_API_KEY` is configured; the known direct credentialed timeout of
about 45 seconds is therefore not resolved. CPCB is operationally degraded and
is not scheduled until a credentialed health check demonstrates a timely data
response. The connector reports LIVE failure honestly and never substitutes
fixtures. OpenAQ remains the scheduled ground-station source.

## Scheduler handoff

Raj defines the jobs below and validates their commands locally. Madhav owns
Cloud Scheduler job creation, service-account/IAM configuration, and wiring
the jobs to deployed services.

The machine-readable handoff is [scheduler-jobs.json](../infra/scheduler-jobs.json).
Madhav should build the `vaayu-ingestion` runner image from
[`ingestion/Dockerfile`](../ingestion/Dockerfile), map the listed
secrets/environment, and create the Cloud Scheduler/Cloud Run Job wiring. The
JSON deliberately does not create cloud resources.

| Job | Cadence | Exact command (working directory: ingestion/) |
|---|---|---|
| vaayu-openaq-latest | Hourly at :05 UTC | `uv run --no-sync vaayu-openaq --latest` |
| vaayu-firms | Hourly at :10 UTC | `uv run --no-sync vaayu-firms --days 1` |
| vaayu-openmeteo | Hourly at :15 UTC | `uv run --no-sync vaayu-openmeteo` |
| vaayu-gee-maiac | Daily, 03:00 UTC | `uv run --no-sync python -m ingestion.gee.maiac_aod --days-back 1` |
| vaayu-gee-s5p | Daily, 03:30 UTC | `uv run --no-sync python -m ingestion.gee.s5p --days-back 1` |
| vaayu-gee-era5 | Daily, 04:00 UTC | `uv run --no-sync python -m ingestion.gee.era5 --kind REANALYSIS --hours-back 24` |

vaayu-cpcb is deliberately absent from the scheduled job set until the
credentialed data.gov.in health check is successful. Its available manual
command remains `uv run --no-sync vaayu-cpcb`.

## OpenAQ request limit

OpenAQ's documented free-tier quota is 60 requests per minute and 2,000 per
hour per API key. `OPENAQ_REQUESTS_PER_MINUTE` defaults to 60; use a higher
value only for an approved custom quota. The connector spaces every request,
including pagination and the hourly `--latest` path, and makes at most one
additional request after an HTTP 429 with a valid `Retry-After` or OpenAQ
`X-RateLimit-Reset` header.

## OpenAQ backfill verification — 2026-08-23

The live command is `uv run --no-sync vaayu-openaq --days 90`. It was not run
in this environment because `OPENAQ_API_KEY` is absent and local Docker/PostGIS
is unavailable. A fixture dry run completed, but it does not verify live API
coverage or database writes. After the key and database are available, record
the command start/end time, sensor totals, failures, records fetched, rows
written, and ingestion status; then query `station` and `station_reading` for
non-zero counts, multiple stations, and timestamp coverage across the requested
window.
