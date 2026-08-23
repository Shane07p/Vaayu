# Ingestion Operations

## CPCB investigation — 2026-08-23

The connector targets CPCB's sanctioned data.gov.in real-time AQI resource:
3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69, with api-key, format=json, and limit
parameters. The current official catalog still lists the hourly resource,
identifies CPCB as its publisher, and shows a 2026 update.

This environment could not complete a credentialed direct API request, so the
reported roughly 45-second timeout was not reproduced or disproved here.
The connector is unchanged: a LIVE failure records SOURCE_UNAVAILABLE and
never substitutes fixtures. Until a credentialed health check succeeds,
OpenAQ is the practical source for scheduled ground-station ingestion and CPCB
remains an independently monitored, degraded source.

## Scheduler handoff

Raj defines the jobs below and validates their commands locally. Madhav owns
Cloud Scheduler job creation, service-account/IAM configuration, and wiring
the jobs to deployed services.

| Job | Cadence | Command (working directory: ingestion/) | Environment / timeout | Dependency and retry note |
|---|---|---|---|---|
| vaayu-openaq-latest | Hourly | uv run vaayu-openaq --latest | OPENAQ_API_KEY, DATABASE_URL; 15 min | Independent; no scheduler retry for per-sensor HTTP 500s because the connector isolates them. A single retry is acceptable only for job-level transport failure. |
| vaayu-firms | Hourly | uv run vaayu-firms --days 1 | FIRMS_MAP_KEY, DATABASE_URL; 10 min | Independent; starts after the hour, before ML attribution. |
| vaayu-openmeteo | Hourly | uv run vaayu-openmeteo | DATABASE_URL; 5 min | Independent; must finish before the forecast runner uses baseline_cams. |
| vaayu-gee-maiac | Daily, 03:00 UTC | uv run python -m ingestion.gee.maiac_aod --days-back 1 | GEE_SERVICE_ACCOUNT_KEY, DATABASE_URL; 30 min | Run before nowcast training. Retry once for job-level Earth Engine outage. |
| vaayu-gee-s5p | Daily, 03:30 UTC | uv run python -m ingestion.gee.s5p --days-back 1 | GEE_SERVICE_ACCOUNT_KEY, DATABASE_URL; 30 min | Run after MAIAC; same retry policy. |
| vaayu-gee-era5 | Daily, 04:00 UTC | uv run python -m ingestion.gee.era5 --kind REANALYSIS --hours-back 24 | GEE_SERVICE_ACCOUNT_KEY, DATABASE_URL; 30 min | Run before nowcast and attribution. |

vaayu-cpcb is deliberately absent from the scheduled job set until the
credentialed data.gov.in health check is successful. Its available manual
command remains uv run vaayu-cpcb.

## OpenAQ request limit

OpenAQ's documented free-tier quota is 60 requests per minute and 2,000 per
hour per API key. `OPENAQ_REQUESTS_PER_MINUTE` defaults to 60; use a higher
value only for an approved custom quota. The connector spaces every request,
including pagination and the hourly `--latest` path, and makes at most one
additional request after an HTTP 429 with a valid `Retry-After` or OpenAQ
`X-RateLimit-Reset` header.
