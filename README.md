# VAAYU

**Forecast-driven air quality intelligence that terminates in statutory action.**

Hyper-local PM2.5 estimation, 72-hour spike forecasting, and transport-based source
attribution — wired into India's existing GRAP and stubble-burning enforcement loops.

> An alert that does not name a statute, an officer, and an action is not an alert.
> It is a chart.

## Documentation

**Start here if you are joining, or if you are an AI agent picking up a task:**

- [**ORIENTATION.md**](docs/ORIENTATION.md) — how to run it, the non-negotiable
  rules, where every file lives, what is real versus seed data, and instructions
  for AI agents (§8)
- [**PLAN.md**](docs/PLAN.md) — where the project stands and the next month's
  work, divided four ways
- [**EVIDENCE.md**](docs/EVIDENCE.md) — the research behind those decisions, with
  sources and honesty grades

Reference:

- [What we are building, in plain language](docs/OVERVIEW.md)
- [Technical reference: architecture, data sources, validation protocol](docs/TECHNICAL.md)
- [Source research: accuracy ceilings, prior art, failure modes](docs/RESEARCH.md)

## Layout

| Directory | Stack |
|---|---|
| `backend/` | Java 21 · Spring Boot 3.4 · Maven |
| `ingestion/` | Python 3.11 · uv |
| `ml/` | Python 3.11 · uv |
| `web/` | Next.js 16 · React 19 · pnpm |
| `infra/` | Docker Compose, Cloud Run definitions |

## Architecture in one paragraph

Python jobs run on a schedule, write predictions into PostGIS, and exit. The Spring Boot
service reads that store and serves a thin REST API. The Next.js application renders an
authority console and a public citizen surface against it. **Python is never in the HTTP
request path** — predictions change only when new data lands, so serving them from a live
Python endpoint would recompute identical numbers per request. The one genuinely real-time
inference path, a citizen photograph classified into an AQI band, is a Gemini call the Java
service makes directly.

The database schema is the contract between the two languages. It is owned by Flyway
migrations in `backend/src/main/resources/db/migration`, and neither side changes a table
the other depends on without a migration.

## Quick start

Requires Docker only. **No API keys needed.**

```bash
cp .env.example .env
make up
```

- Backend health — http://localhost:8080/actuator/health
- API docs — http://localhost:8080/swagger-ui.html
- Web — http://localhost:3000

```bash
make test    # all four suites
make fmt     # format python + web
make down    # tear down, remove volumes
```

### Working on one component directly

Only needed if you want to run a component outside Docker.

| Component | Toolchain | Commands |
|---|---|---|
| `backend/` | JDK 21 | `./mvnw test`, `./mvnw spring-boot:run` |
| `ingestion/` | [uv](https://docs.astral.sh/uv/) | `uv sync --extra dev`, `uv run pytest` |
| `ml/` | uv | `uv sync --extra dev`, `uv run pytest` |
| `web/` | Node 22+, pnpm 11 | `pnpm install`, `pnpm dev` |

uv fetches Python 3.11 itself, so your system Python version does not matter.
The Maven build targets Java 21 regardless of which JDK you have installed.
Node must be 22 or newer — pnpm 11 does not run on Node 20.

## Data modes

Every ingestion source runs in one of two modes, through one code path:

| Key | Mode | Behaviour |
|---|---|---|
| absent | `FIXTURE` | Reads committed sample payloads. The UI badges values `CACHED`. |
| present | `LIVE` | Calls the real upstream endpoint. |

An upstream failure in live mode surfaces `SOURCE_UNAVAILABLE`. It **never** falls back to
fixtures — presenting cached values as fresh telemetry would be fabricating evidence, which
is the failure mode this project most wants to avoid.

### OpenAQ historical backfill

Set `OPENAQ_API_KEY` to use the OpenAQ v3 source; it is sent only in the
`X-API-Key` request header. The default command retrieves the configured 90-day
UTC window for the shared Delhi-NCR box (`76.8,28.2,77.6,28.9`), paginates every
PM2.5 sensor response, and persists readings through the standard ingestion
writer. The `--days` window is intentionally constrained to 60–90 days.

```bash
cd ingestion
uv run vaayu-openaq --days 90
uv run vaayu-openaq --days 90 --dry-run
```

Only OpenAQ values reported in µg/m³ are retained. Requests use v3 sensor
measurement endpoints; v1 and v2 are retired and are never called.

## What the schema enforces

Some of this project's credibility claims are structural rather than conventional:

- `grid_prediction` requires `pm25_q10`, `pm25_q50`, `pm25_q90`, and `coverage_fraction`,
  with a CHECK constraint on quantile ordering. An uncertainty-free point estimate cannot
  be written.
- `forecast` requires `baseline_persistence`. A forecast cannot be recorded without the
  number it must be compared against.
- `citizen_report` has no numeric concentration column at all — only a four-value band.
  No code path can record a µg/m³ value derived from a photograph.

## Honest limits

Model estimates carry real uncertainty and are reported with leave-one-station-out
validation, which scores lower than the random-split numbers most projects report.
Satellites cannot see through cloud and struggle during extreme pollution, so coverage
gaps are shown rather than filled in silently. Photograph-derived air quality is a coarse
band, never a concentration. Trajectories are single-particle wind-field approximations,
not dispersion modelling. See [docs/TECHNICAL.md](docs/TECHNICAL.md) §12.

VAAYU is not affiliated with CPCB, CAQM, ISRO, or any government body. Outputs are decision
support, not official measurements or legal determinations.

## Licence

Apache 2.0. See [LICENSE](LICENSE).
