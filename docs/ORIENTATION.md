# Orientation — read this before touching the code

For anyone joining the project, human or AI agent. Companion to
[PLAN.md](PLAN.md) (what to build) and [EVIDENCE.md](EVIDENCE.md) (why).

---

## 1. What VAAYU is, in one paragraph

An air-quality system for India with two faces: a public surface that tells a
person what the air near them is doing and what to do about it, and a console
that tells an official which place needs them today. It ingests ~370 real
government monitoring stations hourly, NASA FIRMS fire detections, and a CAMS
baseline. Its distinguishing property is not accuracy — it is that **it is
built so that it cannot lie**. Database CHECK constraints, a fixture/live gate
that never silently falls back, and a generation validator that refuses any
number it was not given.

That property is the product. Protect it.

---

## 2. The rules — non-negotiable

These are not style preferences. Several were learned by shipping the opposite
and having to repair the database.

### 2.1 Never put a number on screen that nothing measured

No placeholder concentrations, no example timestamps, no "realistic-looking"
defaults, not even temporarily, not even behind a `CACHED` badge.

We shipped all of these and had to remove them: a hardcoded
`22 AUG 2026 · 14:51 IST`, a weather strip reading `34°C · Sunny` attributed by
name to IMD and ERA5, `Model Engine: VAAYU-XGB-v1` while no model existed, and a
fabricated Gemini photo analysis (`band: POOR, confidence: 62%`) for a
photograph that is never uploaded.

**The honest rendering of "we have no data" is the sentence "we have no data".**

`web/e2e/no-fabricated-values.spec.ts` asserts each removed string absent by
exact text. **Add to that list; never remove from it.**

### 2.2 A failed source is never a fixture

`ingestion/src/ingestion/source.py`: key absent → fixture mode, declared as
`FIXTURE`. Key present but the call fails → raise `SourceUnavailableError`.

**Never** catch an upstream failure and fall back to fixture data. A feed that is
down must be reportable as down. `/api/v1/public/provenance` derives feed state
from `ingestion_run`, so a silent fallback would make the freshness indicator lie.

### 2.3 Distinguish "the source is down" from "we refused the answer"

`SOURCE_UNAVAILABLE` and `UNGROUNDED` are different states and must never be
collapsed. The first is an outage. The second is the grounding validator
catching the model stating a number nobody gave it — that is **the feature
working**, and it is displayed as a deliberate refusal, not an error.

### 2.4 Python writes, Java reads

Python jobs run on a schedule, write to PostGIS, and exit. **Python is never in
the HTTP request path.** The Spring Boot service reads that store and serves
REST. The database schema is the contract between the two languages, owned by
Flyway migrations in `backend/src/main/resources/db/migration/`.

Neither side changes a table the other depends on without a migration.

The one real-time inference path is a Gemini call the Java service makes
directly.

### 2.5 One implementation of the CPCB scale per language

`AqiScale.java` (authoritative, serves the API), `pm25_to_aqi` in
`ml/src/vaayu_ml/models/forecast_lgbm.py`, and `web/lib/aqi-fixture.ts` (dev
fixtures only). Application code must use the AQI the API returns, never
recompute it client-side.

Breakpoints are **contiguous**, not the gapped integer bands CPCB publishes —
the published table leaves 30.5 µg/m³ matching nothing, which fell through to
AQI 500.

### 2.6 Every interval in this project is 80%

All quantile fits are α = 0.1 / 0.5 / 0.9. That is an **80% central interval**,
and it is a **prediction** interval, not a confidence interval.

We previously labelled it 90% and 95% in five places, including the calibration
criterion in `TECHNICAL.md`, where it would have caused a correctly calibrated
model to be rejected. If you change the quantiles, change every label.

### 2.7 Say what you did not do

If a task is partly blocked, finish everything else and state plainly what was
left and why. Do not narrow scope silently.

---

## 3. Running it

```bash
cp .env.example .env
make up            # docker compose up --build -d

# web       http://localhost:3000
# backend   http://localhost:8080/actuator/health
# swagger   http://localhost:8080/swagger-ui.html
```

```bash
make test          # all four suites
make fmt           # ruff + eslint --fix
make down          # tear down, remove volumes
```

Per component:

```bash
cd backend   && ./mvnw test
cd ingestion && uv run --extra dev pytest      # and: uv run --extra dev ruff check .
cd ml        && uv run --extra dev pytest
cd web       && pnpm lint && npx tsc --noEmit
cd web       && pnpm e2e                       # needs the stack up
```

Ingestion jobs are opt-in, so `make up` never writes data as a side effect:

```bash
docker compose run --rm ingestion vaayu-openaq-latest   # current readings, national
docker compose run --rm ingestion vaayu-firms --days 1
docker compose run --rm ingestion vaayu-openmeteo

docker compose --profile scheduler up -d scheduler      # hourly, from infra/scheduler-jobs.json
docker compose --profile scheduler down                 # stop it
```

### Two environment traps

- **`POSTGRES_HOST_PORT` empty in `.env`.** A locally installed PostgreSQL wins
  the bind on 5432, so host connections reach the wrong server and `ml/` cannot
  reach the container database. **Set it to 5433.**
- **`GEE_SERVICE_ACCOUNT_KEY` is a path, not a key.** It points at
  `./secrets/gee-sa.json`, currently a 0-byte file. Earth Engine registration is
  quick and self-service.

Testcontainers tests (`ReadQueryServiceIT`) skip without a reachable Docker
daemon, and `GeminiSmokeIT` skips without `GEMINI_API_KEY`. **A green build with
5 skips is the normal state, not a pass.**

---

## 4. Where things live

```
backend/src/main/java/org/vaayu/
  genai/
    GroundedNarrator.java      generation + the three-outcome contract
    GroundingValidator.java    numeral extraction and set-membership check
    NarrativeFacts.java        the facts a narrative may state, and their numerals
    NarrativeLanguage.java     the eight supported languages
  grap/AqiScale.java           the CPCB scale (authoritative)
  web/
    PublicController.java      /api/v1/public/**   — no auth
    ConsoleController.java     /api/v1/**          — X-Console-Secret
    service/ReadQueryService.java   all SQL projections
    service/GeminiClient.java       REST client, two timeouts (10s / 45s)
  config/ConsoleSharedSecretFilter.java   console auth stub
  resources/db/migration/      Flyway — owns the schema

ingestion/src/ingestion/
  source.py                    fixture/live gate. Read this first.
  openaq_latest.py             national current readings — the live feed that works
  openaq.py                    60–90d backfill — currently failing, upstream 500s
  firms.py, openmeteo.py, cpcb.py
  gee/                         AOD, S5P, ERA5 — all blocked on the credential
  scheduler.py                 runs infra/scheduler-jobs.json locally

ml/src/vaayu_ml/
  models/nowcast_xgb.py        quantile surface — blocked, needs GEE features
  models/forecast_lgbm.py      multi-horizon — blocked, needs history
  evaluation/loso_cv.py        written, tested, NEVER CALLED
  evaluation/blocked_cv.py     written, tested, NEVER CALLED
  evaluation/calibration.py    written, tested, NEVER CALLED
  evaluation/exceedance.py     written, tested, NEVER CALLED
  db.py                        load_feature_frame reads only the 3 empty GEE tables

web/
  app/(citizen)/               aqi, rankings, report
  app/(console)/               map, forecast, worklist, alerts
  app/api/[...path]/route.ts   proxy — why NEXT_PUBLIC_API_URL is "/api"
  lib/api.ts                   typed client, Zod-parsed, seed fallback rules
  lib/schemas.ts               the wire contract — change with the Java DTOs
  lib/i18n.tsx                 3 UI languages (API has 8)
  store/aqiStore.ts            citizen map state
  components/narrative-panel.tsx   the three-outcome UI
  e2e/                         Playwright
```

Read `web/AGENTS.md` before writing Next.js — this is Next 16 and differs from
most training data.

---

## 5. What is real and what is not

| | State |
|---|---|
| `station` / `station_reading` | **Real.** 371 stations, hourly, from OpenAQ mirroring CPCB and state boards |
| `fire_detection` | **Real**, sparse (6 rows) |
| `cams_forecast` | **Real**, but only one Delhi coordinate |
| `grid_prediction` | **400 SEED rows**, mean 169 µg/m³, while real stations read ~27 |
| `forecast` | **15 SEED rows.** Predicts AQI 428 for a city currently at 98 |
| `alert` | **2 SEED rows** |
| `model_run` | One row: `seed` / `seed-v0`. **No model has ever been trained** |
| `gee_aod_snapshot`, `gee_s5p_snapshot`, `met_snapshot` | **0 / 0 / 0** |

**The seed data contradicts the real data on the same screen.** PLAN §4.5 says
what to do about it.

### Dead code — nine files reach no route

```
components/citizen/IntelligencePanel.tsx    ← the orphan root
components/citizen/citizen-hero.tsx
components/citizen/citizen-guidance.tsx
components/citizen/citizen-forecast.tsx
components/citizen/aqi-severity-scale.tsx
components/citizen/trust-grid.tsx
components/data-map.tsx
components/intelligence-chain.tsx
store/mapStore.ts
```

Check reachability before assuming a component is live. Several fabricated
values hid here for weeks.

---

## 6. The database

19 tables. **25 CHECK constraints** enforce the honesty guarantees — these are
the mechanism, not decoration:

- `chk_aod_no_value_without_coverage` — an AOD value cannot exist without a
  coverage fraction
- `chk_alert_interval_contains_estimate` — an alert's interval must contain its
  own point estimate
- `chk_grid_prediction_quantile_order` — q10 ≤ q50 ≤ q90
- `chk_forecast_interval_order`, `chk_ingestion_status`, `chk_citizen_band`, …

`citizen_report` has **no numeric concentration column at all**. A photograph
can yield a coarse band and never a µg/m³ figure — enforced by schema, not by
code review.

Do not weaken a constraint to make an insert pass. The constraint is the
requirement.

---

## 7. API surface

**Public** (`/api/v1/public`, no auth): `/provenance`, `/nearest`,
`/stations`, `/stations/readings`, `/stations/forecastable`,
`/cities/rankings`, `/grid`, `/forecast`, `/advisory`, `POST /reports`

**Console** (`/api/v1`, `X-Console-Secret`): `/alerts`, `/alerts/{id}`,
`/alerts/{id}/narrative`, `/worklist`, `POST /worklist/{id}/action`

Caches (Caffeine): stations 15m, grid 30m, forecast 5m, worklist 5m,
narratives 6h — **OK results only**, never outages.

---

# 8. Instructions for AI agents

If you are an AI agent picking up work from [PLAN.md](PLAN.md), follow this.

## 8.1 Before you start

1. **Read your task in PLAN.md Part 5, and the EVIDENCE.md sections it cites.**
   Every task names the finding that justifies it. If you cannot say which
   evidence your change serves, you are probably building the wrong thing.
2. **Check §2 of this document.** Those rules override your instincts about what
   makes a UI look finished.
3. **Verify the current state yourself.** This document was accurate on
   4 September 2026. Tables fill, feeds break. Query the database; do not trust
   a row count you read here.

## 8.2 While you work

**Verify against the running system, not against your own reasoning.** This
project's failures were all invisible to unit tests: a Docker image that never
copied `public/`, a doubled `/api` prefix, a 2-second timeout aborting a
20-second generation. Every one returned HTTP 200 and rendered a blank panel.

```bash
curl -s localhost:8080/api/v1/public/provenance | head -c 600
docker compose exec -T postgres psql -U vaayu -d vaayu -c "SELECT ..."
cd web && pnpm e2e
```

**If you add anything user-facing, add an E2E test.** Playwright is configured
and drives real Chromium.

**If you remove a fabricated value, add its exact string to
`web/e2e/no-fabricated-values.spec.ts`.** That file is the ratchet.

**Do not add a placeholder to make a screen look complete.** If the data is not
there, render the absence. This is the single most repeated failure in this
codebase's history.

## 8.3 Language on screen

Every string a user reads must pass this test:

> Would a district officer or a rickshaw driver say this phrase out loud?

`Mode: CACHED`, `SYSTEM PROVENANCE`, `AVG COVERAGE 75%`, `1 km Nowcast Surface`,
`OBSERVE → ESTIMATE → FORECAST` all fail it. PLAN §4.3 has the replacement table.

A number never appears alone. Number, band, and one concrete action —
**49.6% of Indians who take no action say the reason is that they do not know
what action to take** (EVIDENCE §1.1). A large red 428 with no instruction is
worse than useless (EVIDENCE §1.2).

## 8.4 When you finish

- Run the suite for **every** component you touched, not just yours.
- Commit messages: say what was wrong and why it mattered, in prose. Look at
  `git log` for the register — these are read by teammates, not parsed.
- **Report honestly.** If tests fail, say so with the output. If you skipped
  part of the task, say which part and why. Do not report completion for work
  that is partly done.
- If you found a bug outside your task, fix it or write it down. Do not leave
  it silently.

## 8.5 Things that will waste your time

| Symptom | Cause |
|---|---|
| Every browser fetch 404s, server pages fine | `NEXT_PUBLIC_API_URL` is `/api`, a mount point, not a prefix. Do not prepend it. |
| Map renders blank, no errors | A static asset 404. Check `public/` is copied in the Docker stage. |
| Gemini "unavailable" but the key works | Read timeout. Generation takes ~20s; classification uses 10s, text uses 45s. |
| Ingestion fails at scale with 429s | Rate limiting, not pooling. `RequestRateLimiter` in `openaq.py`. |
| `ml/` cannot reach the database | Local PostgreSQL owns 5432. Set `POSTGRES_HOST_PORT=5433`. |
| Backend tests "pass" but SQL is untested | `ReadQueryServiceIT` skips without Docker. Check the skip count. |
| A component's changes do nothing | It may be one of the nine unreachable files (§5). |

## 8.6 What you must not do without asking

- Weaken or drop a CHECK constraint
- Make a source fall back to fixtures on failure
- Collapse `SOURCE_UNAVAILABLE` into `UNGROUNDED`, or either into a generic error
- Put a Python service in the HTTP request path
- Add a fourth interval width, or relabel the existing one without changing the
  quantiles
- Present seed data as a prediction
- Claim a validation number that was not produced by a run you can point to
