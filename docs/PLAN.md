# VAAYU — where the project actually stands, and what to build next

**4 September 2026.** Written after a full codebase audit, an external evidence
review, and a spatial-statistics check against our own station data.

This document is meant to be read in order. Part 1 says what was wrong. Part 2
says what the evidence says people need. Part 3 says what our own data will and
will not support — it retires a feature we had planned. Part 4 is the product
direction that follows. Part 5 divides the work between four people.

---

## Part 0 — the one-paragraph summary

VAAYU has ~370 real government monitoring stations flowing in hourly, a working
Gemini pipeline that writes plain-language summaries in eight languages and
refuses to state a number it was not given, and a database schema that makes
several classes of fabrication structurally impossible. It also has no trained
model, a demo dataset that contradicts the real one on screen, and an interface
that speaks entirely in the language of the system rather than the language of
the person reading it. The evidence says the gap nobody in this market has
filled is not sensing and not forecasting — it is **telling a person what the
number means for them, today, in their language, with honest uncertainty**. That
is the one thing we already have the parts for.

---

## Part 1 — what the audit found, and what is now fixed

All of this is committed and pushed on `shane/translate-content-surfaces`
(`cb0989f` … `473309d`).

### 1.1 Values on screen that nothing had measured

| Where | What it said | Reality |
|---|---|---|
| `citizen-hero.tsx` | `Updated: 22 AUG 2026 · 14:51 IST` | A hardcoded string. Every reader, every day. |
| `citizen-hero.tsx` | `34°C · Sunny`, `44%`, `21.2 km/h NW`, `UV 8.1` under **"Meteorological Context (IMD / ERA5)"** | Nothing measured any of it. `met_snapshot` is empty. Attributed by name to two real institutions. |
| `sidebar.tsx` | `Model Engine: VAAYU-XGB-v1`, on every console page | `model_run` holds one row: `seed`. No model has ever been trained. |
| `citizen-report-form.tsx` | `Classified Band: POOR`, `Model Confidence: 62%`, plus a paragraph of Gemini-styled reasoning | Fabricated client-side after every submission. The photograph is never uploaded — the file input only makes a local preview. |

The meteorology strip is the worst of these, because fabricated numbers wearing
someone else's name mislead twice: a reader who checks the attribution is misled
again.

Two of these were in code no route reaches (`citizen-hero` is only imported by
`IntelligencePanel`, which nothing imports). They were latent rather than live —
but they ship the moment anyone wires that panel up.

### 1.2 A country ranked as a city

OpenAQ returns `locality: "India"` for three stations. The connector trusted
`locality` unconditionally, so a country was stored in `station.city`. Because
the ranking groups by city and orders by each city's worst station, **"India"
appeared in "worst air right now" as a city**, pooling Delhi, Mumbai and Chennai
into a single row that could outrank every real entry.

Fixed in the connector (`_city_of` refuses a locality matching the station's own
country) and repaired in the database (`V906`). Those three stations now sit in
the visible `unattributedStations` count, where their absence is honest.

### 1.3 Three different interval widths for one model

Every quantile in this project is fitted at **α = 0.1 and 0.9** — an **80%**
interval. The interface claimed:

- `90% Range` on the map card
- `95% Confidence Interval` on the forecast page
- `95% CI` on the alerts page
- `90% interval` twice in `TECHNICAL.md`

The documentation error was the dangerous one. §6.5 set the calibration
criterion as *"a 90% interval must contain truth ~90% of the time"*. Scored
against that, a **perfectly calibrated model reads as under-covering by ten
points** — the validation protocol would have rejected a correct model.

All now read **80% prediction interval**. (Prediction, not confidence: a
confidence interval bounds a parameter; this bounds a future observation.)

### 1.4 A transient rate-limit poisoned briefings for six hours

`@Cacheable("narratives")` stored `SOURCE_UNAVAILABLE` alongside real prose. The
Gemini free tier allows twenty requests a day; the twenty-first returns 429. One
burst of demo traffic pinned *"the model could not be reached"* onto an alert for
six hours after the quota had reset, unclearable without a restart.

Now excluded from the cache, with a Spring-container test — the existing unit
test constructs the narrator directly and never goes through the `@Cacheable`
proxy, which is why it kept passing while the cache stored outages.

### 1.5 Smaller, real

- `loadLocationData` selected `gridList[length / 2]` — the middle cell of a
  50 km × 44 km box — and labelled it with the city the reader typed.
- A bare English fragment sat outside the i18n table, rendering as
  `real age.rather` and appending English to the Hindi and Punjabi copy.
- Both Gemini prompts had lost their line continuations and carried 13-space
  runs mid-sentence, sent to the model verbatim.
- `NarrativeLanguage.fromCode` used locale-sensitive `toLowerCase()`; in a
  Turkish locale `"HI"` folds to `"hı"` and Hindi is rejected as unsupported.
- Six eslint warnings of unreachable code. The tree is now at zero, so the next
  warning is new.

### 1.6 Browser tests now exist

Playwright drives real Chromium against the running stack: `pnpm e2e`.

Nine tests. They assert **the absence of every fabricated string by exact text**,
because those are easy to reintroduce while making a page look finished. One test
grants geolocation and actually submits a report — the fabricated analysis only
appeared *after* a successful submission, a screen no unit test ever reached.

---

## Part 2 — what the evidence says people need

External review of surveys, government evaluations, and peer-reviewed work.
Evidence strength is marked, because some of this is strong and some is
extrapolated.

### 2.1 The single most important number in this document

**49.6%** of Indians who take no action against air pollution give this reason:

> *"I'm not aware of what action to take — if I knew, I would act."*

Not apathy. Not disbelief. A missing instruction.

Only **35%** both know the term "AQI" and understand its relevance. Outside
Delhi-NCR it collapses — **17%** in Raipur against 82% in Delhi.
*(CMSR Consultants / ASAR, n = 5,000 across 17 cities. **Strong** — large,
India-specific. Caveat: 2018, and skews urban, literate, online.)*

Fear-appeal research is blunt about the failure mode: severity information
**without** a concrete, achievable instruction produces denial and avoidance
rather than protection. *(**Strong** as a general principle; **not**
air-quality-specific.)*

**A large red 428 with no instruction is worse than useless.**

### 2.2 Most of India has no monitor, and that is not an edge case

- **47%** of the population lives entirely outside the monitoring network.
- Only **12%** of census towns and cities have any station at all.
- Against a stated need of ~4,000 stations, the *rural* network was **26
  stations in 26 villages** nationwide as of late 2024.

*(Centre for Science and Environment, plus peer-reviewed monitoring-gap
analysis. **Strong**, figures 1–2 years old.)*

"No monitor near you" is not a corner case to handle gracefully. **It is the
median Indian experience**, and it is the product's central design problem.

### 2.3 Hiding uncertainty is the risk, not showing it

Single-estimate maps "conceal uncertainty and lead to underestimation of risk";
uncertainty-aware formats produced measurably more cautious activity decisions.
*(Preston & Ma, arXiv 2012.11109. **Moderate** — one HCI study.)*

Quantified uncertainty ranges cause a slight dip in trust of the *numbers* and
**no** drop in trust of the *source*. Vaguely gesturing at uncertainty without
quantifying it damages trust in both. *(**Moderate**, general statistics
communication.)*

The cautionary tale is concrete: **BreezoMeter displayed "Good"/green during
active wildfires**, described by reviewers as "extremely dangerous and
irresponsible." SAFAR draws the same complaint — one number for all of Gurgaon,
"Moderate" reported when true AQI exceeded 700.

### 2.4 What already exists, and what we should not rebuild

| Product | Strength | Documented weakness |
|---|---|---|
| **IITM DSS** | Real 72h WRF-Chem forecast for Delhi since 2018. Independently reported **~80% accuracy, ~20% false-alarm rate for AQI > 300**, days 1–5. | CEEW's critique is that GRAP consumes it *reactively* — the model works, the institutional use of it doesn't. |
| **CREAMS (IARI)** | Daily district-wise farm-fire detection from VIIRS/MODIS since 2013, already distributed to officials. | Satellite passes 10:30–13:30 only; farmers reportedly burn after 16:00 to evade it. |
| **Google Air View+** | Real hyperlocal sensor network across 150+ Indian cities, multi-source AI fusion, municipal dashboards. | Independent critique questions how much is measured versus interpolated. |
| **CPCB Sameer** | Official national AQI plus a citizen complaint channel. | 3.8/5. Complaints go unresolved; defaults to Delhi on every open. |
| **SAFAR** | Genuine IITM forecasting pedigree. | ~3.0/5. Four cities. City-wide single number. |

**We cannot out-build Google's sensor network, and we should not compete with
IITM's forecast.** A credible 72h government forecast already exists and is
better than anything we can train.

### 2.5 The strongest causal evidence in the whole review

Farm fires **increase 15%** when wind carries the smoke to a *neighbouring*
jurisdiction, and **decrease 14.5%** when it blows back onto the burning
district's own population. Enforcement action against one farmer reduces
subsequent nearby fires by **13%**.

*(Dipoppa & Gulzar, **Nature** 634:1125–1131, 2024. 207 districts across India
and Pakistan, 2012–2022. **Strong** — large-N, causal, peer-reviewed, exactly
our geography.)*

Officials respond to whether **they personally** will be blamed for the smoke.

This validates the fire worklist concept and tells us precisely what it must
compute: not a pin on a map, but **downwind cross-jurisdiction exposed
population, with the accountable authority named**. CREAMS already does
detection. The gap is attribution and accountability.

### 2.6 Who is most underserved

**Outdoor workers.** Delhi delivery riders measured at PM10/PM2.5/PM1 of
**516 / 180 / 113 µg/m³** against WHO guidelines of 45 / 15. **67% had no
awareness that pollution was harming their health.** *(**Moderate** —
journalistic and preliminary-study sourcing, small samples, but consistent
across independent outlets.)* Traffic police carry the highest documented
occupational burden in Delhi. *(**Moderate**, peer-reviewed.)*

These people are outdoors during exactly the hours a timing recommendation could
help with, and are least likely to be reading a desktop dashboard.

**Low-literacy and non-English users.** Colour-coded interfaces combined with
local-language *voice* outperformed text-heavy menus. *(**Weak/Moderate** —
general design literature, not air-quality-specific.)* Our three UI languages
against eight in the API is a gap; text-only translation is a second one.

### 2.7 What the evidence says NOT to build

- **A proprietary hyperlocal surface with unearned confidence.** This is exactly
  where BreezoMeter and SAFAR damaged user trust.
- **A general "AI chatbot for air quality".** Its own researchers describe the
  evidence base as exploratory, small-sample, and lacking control groups.
- **Undifferentiated daily push alerts.** Response drops roughly 30% per
  repetition. *(**Strong** for clinical alerting; **extrapolated** here.)*
- **Automated school-closure recommendations.** Contested policy — closures
  don't demonstrably improve outcomes and disproportionately hurt children
  without home resources.
- **Re-deriving fire detection.** CREAMS already does it.

---

## Part 3 — what our own data will and will not support

We planned a model that estimates PM2.5 where there is no monitor, from the
monitors around it. Before building it, we measured whether PM2.5 is spatially
predictable at all, using an empirical variogram over our own stations.

**Method.** For every pair of stations reporting in the same hour, compute
distance apart and semivariance ½(z₁−z₂)². If air is spatially predictable,
nearby pairs agree and semivariance stays below the total variance (the *sill*).

### 3.1 National, two snapshots (245 and 214 stations, sill = 275)

| distance | semivariance | correlation |
|---|---|---|
| 0–10 km | 155–201 | 0.35–0.42 |
| 10–20 km | 276–292 | 0.22–0.31 |
| 20–30 km | 276–374 | 0.10–0.15 |
| 30–40 km | 296–433 | **0.01** |
| 40 km+ | ~250–310 | ~0 |

Semivariance reaches the sill by **10–20 km**. Correlation is gone by **30 km**.
Beyond that there is no spatial information — a model would be predicting the
national mean.

### 3.2 Within Delhi-NCR (47 stations, sill = 398)

| distance | semivariance | correlation |
|---|---|---|
| 0–5 km | **712** | −0.13 |
| 5–10 km | 325 | −0.10 |
| 10–20 km | 369–488 | ~0 |

**Two Delhi monitors 3 km apart differ nearly twice as much as two random NCR
monitors do.** Correlation is zero or negative at every range.

### 3.3 What this means

**Spatial interpolation is retired.** A model would lose to inverse-distance
weighting, and IDW would lose to honestly saying we don't know. Building it would
have produced exactly the failure mode §2.3 documents.

**Caveats, and one matters.** This is monsoon season, mean 26.5 µg/m³ — low
signal, noise-dominated. A winter smog episode is regionally coherent and would
look very different; this is plausibly the worst case. It is also two snapshots
from one day. **Re-run this in November.** But we do not build a model on the
hope that the data improves.

**The excess short-range variance is itself the finding.** Two monitors 3 km
apart disagreeing more than the regional spread means either broken sensors or
genuine roadside-versus-background siting differences. Both point at the same
work: **data quality detection**. That is now the ML with actual evidence behind
it, and it protects every other number in the product. We have already shipped
one instance of exactly this bug — a carbon monoxide reading stored as PM2.5 of
3,320 µg/m³.

**It also settles the product question.** We do not decline to interpolate out of
caution. We decline because **the physics does not support it.** That is a much
stronger sentence to be able to say.

---

## Part 4 — the direction

### 4.1 The principle: teach and show at the same time

Not a Learn page. Nobody opens a Learn page. The number teaches you what it means
**as you are looking at it**.

Three mechanisms:

**1. A number never appears alone.** Always number, band, and one concrete action.

```
   98   Moderate
   Fine to be outside today. If you have asthma,
   carry your inhaler.
```

**2. Explain in place.** Every term expands where it stands. Tap "Moderate" and
the CPCB scale unfolds inline with 98 marked on it. Tap "2.6 km away" and it
explains why distance matters. No navigation, no modal.

**3. First visit teaches using the reader's own real number.** Skippable,
non-blocking, three steps, pointing at data already on screen. The product is the
tutorial.

This is the direct answer to §2.1: the 49.6% who would act if they knew what to
do.

### 4.2 The answer rule for "air near you"

Agreed: graded, with a refusal floor. §3 gives us the honest thresholds.

| condition | what we show |
|---|---|
| monitor < 10 km, reported < 6h | **"Air near you"** — the reading, station named, distance and age stated |
| monitor 10–30 km, fresh | **"Nearest measurement"** — reframed, distance in the sentence, not the small print |
| > 30 km, or stale | **Refuse.** Name a place we do know, and offer it. |

30 km is not a guess. It is where correlation reaches zero in our own data.

### 4.3 Naming — plain words only

The interface currently speaks in invented operational language. Every one of
these goes.

| Now | Becomes |
|---|---|
| Authority Console | **For officials** |
| DELHI-NCR PILOT COMMAND | **Delhi NCR** |
| Situation Map | **Map** |
| Forecast Intelligence | **Forecast** |
| Fire Worklist | **Farm fires** |
| Statutory Alerts | **Action notices** |
| Citizen Surface | *(delete the heading)* |
| Check My Air | **My air** |
| SYSTEM PROVENANCE | **Where this comes from** |
| Mode: CACHED | **Last updated 40 minutes ago** |
| Telemetry: Live Sync · Operational | *(delete — it contradicts the line below it)* |
| 1 km Nowcast Surface | **Estimated map** |
| AVG COVERAGE 75% | *(delete — meaningless without context)* |
| Grid cells / Stations / Fire clusters counts | *(delete — inventory, not information)* |
| OBSERVE → ESTIMATE → FORECAST → ATTRIBUTE → ALERT → ACT | *(delete — describes our pipeline, not the reader's problem)* |
| PROD badge | *(delete — it is not production)* |

Rule going forward: **if a district officer or a rickshaw driver would not say
the phrase out loud, it does not go on screen.**

### 4.4 What replaces the console's hero card

`CURRENT AIR QUALITY · 168 µg/m³ · AQI 337 · VERY POOR` is an average of 400
hand-written seed cells, displayed larger than anything else on the page, while
371 real station markers on the same map read around 27.

It becomes **"What needs attention today"** — a ranked queue built only from data
that is real: worst measured stations, fire clusters past their unactioned
threshold, alerts nobody has acknowledged. Each row says why it is there and what
the officer can do. An empty queue is a legitimate answer and reads fine.

### 4.5 The seed-data decision

`grid_prediction` holds 400 `SEED` rows averaging 169 µg/m³ while real stations
read 27. Seed forecasts predict AQI 428 "Severe" for a city currently at 98.

**The seed surface and seed alerts must stop being rendered as predictions.**
They contradict the only part of the product that is real, on the same screen.
Options, in order of preference:

1. Remove them from the interface entirely; the map shows measurements only.
2. Keep one clearly-labelled demo alert on a separate "example" route.

Not acceptable: leaving them where they are because a small amber `CACHED` chip
is present.

---

## Part 5 — the work, divided four ways

Names are the current owners' best fit; reassign freely. Each block is written so
one person can work without blocking on another.

Every task is marked **[real data]** — buildable today — or **[blocked]**.

---

### Person A — Shane · the explanation layer

*The differentiator. Everything here runs on data we already have.*

**A1. Explain-in-place components** **[real data]**
Build the three mechanisms in §4.1 as reusable components: `Figure` (number +
band + action sentence), `ExplainInline` (expands a term where it stands), and
`FirstVisit` (three-step, skippable, uses the reader's real number).
*Done when:* no bare number appears anywhere in the citizen surface without a
band and an action sentence beside it.

**A2. Guidance content, per band and per audience** **[real data]**
The action sentences themselves. Six CPCB bands × the audiences in §2.6 (general,
asthma/COPD, pregnant, elderly, outdoor worker, children). Written plainly.
*Grounded in §2.1 and §2.6.* Present these as directionally reasonable, not as
evidence-backed precision medicine — the review of personal protective strategies
is explicit that overall evidence quality is lacking.
*Done when:* every band renders a specific, achievable instruction, and the
tailoring is visible without an account or a profile.

**A3. Extend the grounding validator beyond numerals** **[real data]**
The numeral check is load-bearing and works. Extend coverage so every generated
*sentence* is checked against the supplied facts, not only its digits. Frame the
system prompt explicitly as translation and simplification only, never new facts.
*Grounded in §2.7 and the hallucination literature.*

**A4. Make the generated summary discoverable** **[real data]**
Today it hides behind a button labelled "Explain this" that produces nothing
until clicked. Our most differentiated capability is invisible.
*Done when:* a first-time reader encounters the plain-language explanation
without having to guess that a button will produce one.

---

### Person B — Tanishq · the front door and the citizen surface

*Owns everything a member of the public sees.*

**B1. Home page: answer first, explain below** **[real data]**
Live number as the hero, no marketing above it. Below the fold: where the number
comes from, what we cannot tell you yet, and the three onward links.
*Done when:* a first-time visitor who scrolls once can say what VAAYU does and
why it is trustworthy.

**B2. Implement the answer rule** **[real data]**
The three states in §4.2, using the 10 km / 30 km thresholds from §3.
*Done when:* a location with no monitor within 30 km gets a refusal that names a
place we do know — never a number borrowed from another city.

**B3. Rename everything** **[real data]**
The table in §4.3, end to end. Delete the contradictory status chrome.

**B4. Eight languages, and beyond text** **[real data]**
The API supports eight; the UI offers three. Close it. Then add voice output and
an icon system — §2.6 says translated text alone does not reach low-literacy
users, and GIGW 3.0 sets the accessibility floor.
*Done when:* the eight API languages are selectable, and each band has an icon
and an audio reading.

**B5. Outdoor-worker view** **[real data]**
A one-tap mode reframing today's real hourly station data around shift timing —
"worse 7–10am here today, deliver later if you can." Derivable from real readings
without any forecast.
*Grounded in §2.6: 516 µg/m³ measured exposure, 67% unaware.*

---

### Person C — Raj · data, quality, and the only ML we should build

*Owns everything upstream of the API.*

**C1. Keep the collector running** **[real data]** — *time-critical*
The hourly scheduler is now running (`docker compose --profile scheduler up -d`).
Every hour it is down costs ~250 rows. Move it somewhere that survives a laptop
reboot.
*Done when:* ingestion runs unattended and a dashboard shows rows-per-hour.

**C2. Sensor anomaly detection** **[real data]** — *this is the ML*
Flag readings that contradict their neighbours: stuck sensors, unit errors, a CO
reading stored as PM2.5. §3.2 shows short-range disagreement exceeding regional
variance, so there is real signal here — and we have already shipped this exact
bug at 3,320 µg/m³.
*Done when:* flagged stations are excluded from rankings and estimates, with the
reason recorded and visible.
*Note:* no labelled fault set exists, so validate by manual review of what it
flags, and report precision honestly rather than inventing a recall number.

**C3. Re-run the variogram monthly, and in November** **[real data]**
§3 is two snapshots in monsoon. Automate it. If winter shows real spatial
structure, spatial interpolation comes back on the table — with LOSO validation
and IDW as the baseline it must beat.
*Done when:* the variogram is a scheduled job writing to a table, not a
one-off query.

**C4. Fix or retire the historical backfill** **[real data]**
`openaq.py` fails with upstream 500s. Without history there is no forecasting and
no temporal validation, ever. Either fix it or record clearly that we have no
history and stop implying otherwise.

**C5. Run the validation that already exists** **[real data]**
`loso_splits`, `blocked_cv`, `calibration`, `exceedance` are all written and
tested and have **never been called**. Wire them to a runner so §6.5 of
`TECHNICAL.md` stops being a table of dashes. Apply to C2 first, since that is
the model we will actually have.

---

### Person D — Madhav · officials, enforcement, and infrastructure

*Owns the console and everything that makes it deployable.*

**D1. Replace the console hero with "What needs attention today"** **[real data]**
§4.4. Built only from real measurements, real FIRMS clusters, and real alert
timestamps.
*Done when:* every row names a place, a reason, and an action, and none of it
comes from seed data.

**D2. Downwind cross-jurisdiction fire attribution** **[real data]**
*The highest-evidence feature in this document.* For each fire cluster, compute
where the smoke goes using wind, which jurisdiction's population it lands on, and
name the accountable authority.
*Grounded in Dipoppa & Gulzar (Nature, 2024): fires rise 15% when smoke crosses
into someone else's district and fall 14.5% when it blows back home. Officials
respond to personal accountability.*
*Inputs:* FIRMS (real), Open-Meteo wind (real, but currently fetched for a single
Delhi coordinate — needs extending), district boundaries and population (static
reference data).
*Do not* rebuild fire detection; CREAMS already does it.

**D3. Resolve the seed data** **[real data]**
Implement §4.5. This is the change that stops the console contradicting itself.

**D4. GEE credential** **[blocked → unblockable today]**
`secrets/gee-sa.json` is a 0-byte file. Earth Engine registration is quick and
self-service. This unblocks nothing on the critical path any more — spatial
interpolation is retired and we are not competing with IITM's forecast — but it
is a prerequisite for any future satellite work, and it costs an hour.

**D5. Deployment** **[real data]**
Nothing is deployed. A public URL is worth more than another feature. Note that
`.env` has an empty `POSTGRES_HOST_PORT`, which lets a local PostgreSQL win the
bind and blocks `ml/` from reaching the container database — set it to 5433.

**D6. Investigate citing IITM DSS** **[open]**
§2.4: a credible 72h government forecast already exists at ~80% accuracy for
AQI > 300. Determine whether its output is publicly reusable. If it is, we
present *their* forecast plainly rather than pretending to our own.

---

## Part 6 — sequencing

**Week 1** — B3 (renaming) and D3 (seed data) first, together. They are cheap and
they stop the product contradicting itself, which every other task is built on
top of. C1 in parallel, because data accumulation is time-critical.

**Week 2** — A1/A2 and B1/B2. The explanation layer and the front door. This is
the demo.

**Week 3** — D1, D2, C2. The console becomes useful and the ML becomes real.

**Week 4** — B4, B5, C5, D5. Reach, accessibility, validation numbers, and a
public URL.

---

## Part 7 — what we still don't know

Carried from the evidence review, honestly:

1. **No India-specific study compares colour-band versus plain-sentence versus
   numeric-only AQI communication head to head.** Our format choices are
   extrapolated from adjacent domains. A small A/B test inside our own citizen
   surface would settle it cheaply — and would be a genuinely novel contribution.

2. **We have no first-person account of what CPCB/DPCC field officers actually
   lack.** The audits document *that* enforcement fails and by how much, never
   what tool would help. Three structured interviews would be worth more than the
   entire secondary literature.

3. **Whether IITM DSS output is publicly reusable.** Determines D6.

4. **Whether the §3 result survives winter.** The single most important open
   question for the ML direction. Re-run in November.

5. **How low-literacy users actually respond to voice and icons.** The supporting
   evidence is thin and not air-quality-specific. One afternoon at a construction
   site or vegetable market beats the literature.

---

## Appendix — current system state

| | |
|---|---|
| Stations with readings | 371 |
| Station readings stored | ~900, growing hourly |
| Trained models | **0** — `model_run` holds `seed` / `seed-v0` |
| `grid_prediction` | 400 rows, all `SEED`, mean 169 µg/m³ |
| `gee_aod_snapshot` / `gee_s5p_snapshot` / `met_snapshot` | **0 / 0 / 0** |
| Live feeds | OpenAQ current, NASA FIRMS, Open-Meteo CAMS |
| Dead feeds | CPCB CAAQMS (upstream down 12d), OpenAQ backfill (upstream 500s) |
| UI languages / API languages | 3 / 8 |
| Tests | 105 backend · 162 ingestion · 65 ML · 9 browser |
| `TECHNICAL.md` §6.5 validation results | still all `—` |
| Deployed | no |
