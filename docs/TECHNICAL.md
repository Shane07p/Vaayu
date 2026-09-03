# VAAYU

### Forecast-driven air quality intelligence that terminates in statutory action.

*Hyper-local PM2.5 estimation, 72-hour spike forecasting, and transport-based source attribution — wired into India's existing GRAP and stubble-burning enforcement loops.*

---

## TEAM DECLARATION

| | |
|---|---|
| **Team** | _[your team name]_ |
| **Hackathon** | Build with AI: Code for Communities (Hack2Skill × GDG) |
| **Problem Statement** | 02 — Clean Air & Climate Resilience |
| **BRICS Theme** | Sustainability |
| **Pilot Region** | Delhi-NCR + Punjab/Haryana source corridor |
| **Live Demo** | _[url]_ |

---

## 1. THE PROBLEM, RESTATED PRECISELY

> *"Major BRICS cities monitor macro-level air quality but consistently miss hyper-local and cross-border pollution events... The absence of real-time, granular data prevents coordinated climate action and directly threatens public health."*

India operates roughly 1,296 ambient monitoring stations across 473 cities, of which only a few hundred are real-time CAAQMS. For a country of 3.29 million km², this is a measurement grid so sparse that entire districts — and the majority of parliamentary constituencies — have **no local air quality measurement at all**.

But the sparsity is only half the problem. The other half is that **detection already exists and is not the bottleneck.** ISRO/IARI-CREAMS, the Punjab Remote Sensing Centre, CPCB's CAAQMS network, and SAFAR all produce data today. Punjab deployed 10,500 field functionaries in the 2025 season. CAQM issues binding directives. The machinery exists.

What is missing is the layer between measurement and enforcement:

- **Where** is pollution actually high, in the 95% of territory with no station?
- **When** will it spike, early enough to invoke a response *before* the exceedance?
- **Which** of thousands of simultaneous fire detections will actually reach a population centre — so that finite enforcement capacity is aimed correctly?

VAAYU answers those three questions and hands the answer to the authority who already has the legal power to act on it.

---

## 2. WHY EXISTING SYSTEMS DON'T CLOSE THIS

| System | What it does | The gap VAAYU fills |
|---|---|---|
| **CPCB CAAQMS / SAMEER** | Authoritative point measurements + public AQI + complaints | Point data only; no interpolation, no forecast, no targeting |
| **SAFAR (IITM)** | Chemistry-transport 72h forecasts | Four metros only; city-scale, not 1 km; no enforcement hook |
| **CREAMS / PRSC** | Daily satellite fire bulletins to districts | Detects fires; does not rank them by downwind population impact |
| **Google Maps Air Quality API** | 500 m fused AQ, 96h forecast, 100+ countries | Consumer-facing black box; no action layer, no district workflow |
| **Typical hackathon builds** | Kaggle CSV → XGBoost → Streamlit dashboard | Random train/test splits leak spatial autocorrelation; no satellite fusion; alerts go nowhere |

**Positioning statement:** VAAYU is not a monitoring network and not a dashboard. It is a *decision-support layer* that consumes existing public data and emits enforcement-ready, legally-mapped alerts.

---

## 3. CORE PRINCIPLE

> **An alert that does not name a statute, an officer, and an action is not an alert. It is a chart.**

Every output of this system terminates in one of three places:
1. A **GRAP stage recommendation** to the CAQM sub-committee, issued 24–72h before the exceedance.
2. A **ranked enforcement worklist** to a District Magistrate, ordered by predicted downwind population exposure.
3. A **public exposure advisory** at 1 km resolution for citizens in unmonitored districts.

---

## 4. SYSTEM ARCHITECTURE

```
┌───────────────────── INGESTION (Cloud Run, scheduled) ─────────────────────┐
│                                                                            │
│  data.gov.in / CPCB      OpenAQ v3        NASA FIRMS        Open-Meteo     │
│  (hourly stations)       (harmonised)     (VIIRS 375m)      (CAMS fcst)    │
│         │                    │                 │                 │         │
│  Google Earth Engine ──────────────────────────────────────────────────┐   │
│  MCD19A2 AOD 1km · S5P NO2/AER_AI · ERA5 BLH+wind · WorldPop           │   │
└────────────────────────────────┬───────────────────────────────────────┘   │
                                 ▼
┌───────────────────────── STORAGE (BigQuery + GCS) ─────────────────────────┐
│  fact_station_hourly · fact_fire_events · dim_grid_1km · raster COGs       │
└────────────────────────────────┬───────────────────────────────────────────┘
                                 ▼
┌──────────────────────── INFERENCE (Vertex AI) ─────────────────────────────┐
│                                                                            │
│  [A] NOWCAST      XGBoost quantile → 1km PM2.5 surface + 80% interval      │
│  [B] FORECAST     LightGBM multi-horizon 6/24/72h + persistence baseline   │
│  [C] ATTRIBUTION  HYSPLIT back-trajectory → fire cluster → impact rank     │
│  [D] CITIZEN      Gemini multimodal → AQI band (soft evidence only)        │
└────────────────────────────────┬───────────────────────────────────────────┘
                                 ▼
┌────────────────── ACTION ENGINE (the differentiator) ──────────────────────┐
│  Forecast AQI ──► GRAP stage rule ──► Alert packet:                        │
│    { predicted_aqi, horizon, confidence_interval, grap_stage,              │
│      mandated_actions[], jurisdiction, statutory_basis,                    │
│      exposed_population, escalation_trigger }                              │
└──────────────┬──────────────────────────────────┬──────────────────────────┘
               ▼                                  ▼
    AUTHORITY CONSOLE                      CITIZEN APP (Firebase)
    (CAQM / DPCC / DM)                     Advisory + report submission
```

---

## 5. DATA SOURCES — EXACT, VERIFIABLE, FREE

### 5.1 Ground truth (India)

| Source | Access | Resolution | Latency | License |
|---|---|---|---|---|
| **CPCB Real-time AQI** | `api.data.gov.in/resource/3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69` (free key) | Station point | ~1 h | GODL-India |
| **OpenAQ v3** | `api.openaq.org/v3` (`X-API-Key` header) | Station point | ~1 h | CC BY 4.0 |
| **CPCB CCR bulk** | `app.cpcbccr.com/ccr` manual export | 15-min | Archive | Govt |

> ⚠️ **Honest disclosure:** the `app.cpcbccr.com` station API used by many projects is **reverse-engineered and unofficial**. VAAYU ingests via the sanctioned data.gov.in resource. v1/v2 OpenAQ endpoints were retired 31 Jan 2025 and return HTTP 410 — we use v3 only.

### 5.2 Satellite (Google Earth Engine)

| Product | EE Collection ID | Resolution | Cadence |
|---|---|---|---|
| MAIAC AOD | `MODIS/061/MCD19A2_GRANULES` | 1 km | Daily |
| TROPOMI NO₂ | `COPERNICUS/S5P/NRTI/L3_NO2` | ~3.5×5.5 km | ~Daily, 3h latency |
| TROPOMI Aerosol Index | `COPERNICUS/S5P/NRTI/L3_AER_AI` | ~3.5×5.5 km | ~Daily |
| Active fire | NASA FIRMS API `firms.modaps.eosdis.nasa.gov/api/area/` | 375 m (VIIRS) | ~3 h |
| Population | `WorldPop/GP/100m/pop` | 100 m | Annual |

**Gotchas we handle explicitly:**
- `AOD_QA` bitmask is decoded, not ignored — unmasked MAIAC includes low-confidence retrievals.
- AOD has systematic gaps under cloud, snow, and *high pollution*. Ignoring these gaps biases exposure estimates upward; published Indian work found gap-blind analysis overestimated attributable mortality by ~94,000 deaths over 2017–2022. We gap-fill and report coverage fraction per cell.
- S5P returns small negative column values over clean regions — these are physically meaningful retrieval noise and are **not** clipped to zero.

### 5.3 Meteorology

| Source | Access | Use |
|---|---|---|
| ERA5 hourly | `ECMWF/ERA5/HOURLY` (EE) | Boundary layer height, wind u/v, RH, T |
| GFS forecast | `NOAA/GFS0P25` (EE) | Forward wind fields for transport |
| Open-Meteo AQ | `air-quality-api.open-meteo.com/v1/air-quality` | CAMS-based forecast **baseline to beat** |

> **IMD is not used.** Indian Meteorological Department bulk/programmatic data is restricted and paid. Using ERA5/GFS keeps the pipeline reproducible and open — a requirement for Digital Public Good status.

---

## 6. MODELS AND — CRITICALLY — HOW THEY ARE VALIDATED

### 6.1 Nowcast: sparse stations → 1 km surface

**Model:** XGBoost quantile regression (q10/q50/q90).
**Features:** MAIAC AOD 047/055, AOD uncertainty, column water vapour, ERA5 BLH / wind speed / wind direction / RH / temperature, S5P NO₂ and aerosol index, elevation, road density, built-up fraction, distance to nearest station, day-of-year, hour.

**Why not a naive AOD × constant conversion:** AOD is a *column-integrated* optical measure. Surface PM2.5 depends on boundary layer height (the column may sit aloft), hygroscopic growth under humidity, vertical aerosol profile, and speciation. Linear conversion is the single most common technical error in this problem space and it fails hardest exactly during monsoon and during the winter episodes that matter most.

### 6.2 Forecast: 6 / 24 / 72 hour spike prediction

**Model:** LightGBM multi-horizon, one model per horizon.
**Features:** lagged PM2.5 (1/3/6/12/24h), rolling statistics, forecast met from GFS, **upwind FIRMS fire count weighted by wind alignment**, BLH forecast, seasonal terms.

**Mandatory baselines reported alongside:**
- Persistence (`t+h = t`) — deceptively strong at 6h
- Seasonal climatology
- Open-Meteo/CAMS forecast

A model that does not beat persistence at its stated horizon is reported as not beating persistence. We do not hide baselines.

### 6.3 Attribution: which fires actually matter

FIRMS detections are clustered (DBSCAN, haversine metric), then HYSPLIT back-trajectories from receptor sites are computed via **PySPLIT** with GDAS meteorology. Each fire cluster receives an **Impact Rank**:

```
impact = f(fire_radiative_power, trajectory_intersection,
           transport_time, downwind_population, dispersion_potential)
```

This converts "3,400 fires detected today" into "these 12 clusters in these 4 tehsils will drive tomorrow's Delhi episode."

### 6.4 Citizen photos: deliberately constrained

Gemini multimodal returns a **coarse AQI band**, never a µg/m³ value. Published literature on PM2.5-from-photograph tops out around R² ≈ 0.6, and degrades badly with camera pipeline variation, exposure, sun angle, and cloud-vs-haze confusion.

Citizen input therefore enters the system as **soft evidence with a confidence weight**, used for (a) event localisation, (b) corroboration of a satellite/station anomaly, (c) covering the documented **night-burning detection gap** — satellites overpass at ~13:30 and post-midnight, and burning has demonstrably shifted to evade them. CEEW field validation found satellites detected only 7 of 169 fires visible in high-resolution imagery.

### 6.5 Validation protocol

This section exists because it is where most submissions in this space fail.

| Check | Method | Why |
|---|---|---|
| **Spatial generalisation** | Leave-one-station-out CV | Random splits let the model memorise a station's mean. Reported R² collapses under LOSO — we report both. |
| **Temporal generalisation** | Forward-chaining blocked CV | Random splits on time series leak the future. |
| **Episode skill** | Precision / Recall / F1 on AQI > 300 exceedance | RMSE is dominated by ordinary days. The product is about spikes. |
| **Seasonal breakdown** | Metrics reported separately for winter / monsoon / summer | Monsoon degrades AOD–PM relationships; a single annual number hides this. |
| **Calibration** | Reliability diagram on quantile intervals | The surface is fitted at quantiles 0.1, 0.5 and 0.9 (`NowcastModel.QUANTILES`), so q10-q90 is an 80% central interval and must contain truth ~80% of the time. Scoring it against 90% would read a well-calibrated model as under-covering. |

**Reported results** _(fill from your run)_:

| Metric | Nowcast | 24h Forecast | 72h Forecast |
|---|---|---|---|
| R² (random split) | — | — | — |
| R² (LOSO / blocked) | — | — | — |
| RMSE (µg/m³) | — | — | — |
| Exceedance F1 | — | — | — |
| Beats persistence? | n/a | — | — |
| Beats CAMS/Open-Meteo? | — | — | — |

**Calibrated expectation:** published Indian AOD→PM2.5 work reports R² ≈ 0.53 (Chennai, coastal), 0.71 (NW India data-scarce districts, RMSE 31.6), and 0.87 (Maharashtra, RMSE 12.6) at daily scale. We expect to land in that band. **Any submission claiming R² > 0.9 at hourly 1 km without LOSO validation should be treated as unvalidated.**

---

## 7. THE INTERVENTION LOOP

This is the layer that separates VAAYU from a visualisation.

### 7.1 GRAP mapping

CAQM's Graded Response Action Plan is **invoked pre-emptively based on forecasts** — the sub-committee has repeatedly invoked stages in advance when models indicated an imminent breach. That is a live decision point that consumes exactly what VAAYU produces.

| Forecast AQI | GRAP Stage | Mandated actions (abridged) |
|---|---|---|
| 201–300 "Poor" | **I** | 27-point plan: dust suppression, anti-smog guns, mechanised road sweeping, open-burning enforcement |
| 301–400 "Very Poor" | **II** | 12-point plan: intensified dust control, parking surcharge, augmented public transport, DG set restrictions |
| 401–450 "Severe" | **III** | 9-point plan: non-essential construction halt, BS-III petrol / BS-IV diesel LMV curbs, brick kiln and stone crusher closure |
| > 450 "Severe+" | **IV** | Truck entry restrictions, construction stoppage, staggered timings, school measures |

*Thresholds per the GRAP schedule as revised 21.11.2025. The rules engine reads these from a versioned config file, not hardcoded — statutory thresholds change and the system must track them.*

### 7.2 Stubble-burning enforcement targeting

CAQM Direction 95 (01.10.2025) authorises district authorities to file complaints before jurisdictional judicial magistrates where officials fail to enforce stubble-burning measures. Enforcement capacity is real and finite: 10,500 field functionaries in Punjab (2025), a 1,700-strong Prali Protection Force, 31 CPCB flying squads.

VAAYU emits a **ranked daily worklist** per district: fire clusters sorted by predicted downwind impact, with tehsil, coordinates, cluster size, predicted arrival window at the nearest population centre, and the Direction-95 escalation flag if the cluster persists across consecutive days without recorded action.

### 7.3 Alert packet schema

```json
{
  "alert_id": "VAAYU-2026-NCR-00184",
  "issued_at": "2026-11-04T06:00:00+05:30",
  "horizon_hours": 48,
  "predicted_aqi": 428,
  "confidence_interval_90": [391, 461],
  "recommended_grap_stage": "III",
  "statutory_basis": "CAQM GRAP Schedule (rev. 21.11.2025), Stage III",
  "jurisdiction": ["DPCC", "GMDA", "UPPCB"],
  "mandated_actions": ["halt_non_essential_construction", "close_brick_kilns"],
  "exposed_population": 18400000,
  "dominant_source": {
    "type": "crop_residue_transport",
    "clusters": ["PB-SGR-0412", "HR-KTL-0198"],
    "trajectory_confidence": 0.81
  },
  "escalation": {
    "direction_95_eligible": true,
    "consecutive_days_unactioned": 3
  },
  "model_version": "forecast-lgbm-v0.4.2",
  "evidence_sources": ["CPCB", "MCD19A2", "ERA5", "FIRMS-VIIRS"]
}
```

Every alert carries its model version, its uncertainty, and its evidence provenance. An authority acting on this can audit it.

---

## 8. "FEDERATED" — AN HONEST READING

The problem statement asks for a *federated* platform enabling BRICS nations to share predictive models. We interpret this deliberately and state our reasoning.

**Federated learning is not the right primitive here, and we do not pretend otherwise.** Federated learning solves the problem of training on data that cannot leave its jurisdiction. Ambient air quality data is, by design and by law in most jurisdictions, public. OpenAQ already aggregates four of the five BRICS nations. Deploying FedAvg to protect data that is published on government websites would be architecture theatre.

**What we build instead is a federated data architecture:**

- Each participating node exposes its own sensors through an **OGC SensorThings API** endpoint (FROST-Server reference implementation). No node surrenders custody.
- Gridded products are published as **Cloud-Optimized GeoTIFF / Zarr**, catalogued via **STAC**, and queryable through **OGC API – EDR**.
- Models are shared as versioned, signed artifacts with their training provenance and validation metrics attached — a nation can adopt a model *and audit how it was evaluated*.
- All concentrations are exchanged in **raw µg/m³**, never national AQI. India's CPCB scale, China's HJ 633-2012 breakpoints, and the US EPA scale are not comparable; harmonising on the index rather than the concentration silently corrupts cross-border analysis.

**Where true FL genuinely earns its place** — and where our roadmap places it (Flower, framework-agnostic, supports simulated multi-client evaluation) — is jointly training on *auxiliary* data that really is sensitive: proprietary industrial emissions telemetry, or health outcome records.

**Disclosed asymmetry:** BRICS air quality openness is not uniform. India offers a clean keyed REST API. China's CNEMC has no official API (scrape-only, mirrored via OpenAQ). Brazil is decentralised across CETESB/MonitorAr/IEMA. South Africa's SAAQIS grants API access on request. **Russia's Roshydromet publishes no open real-time API; reports are paywalled and some data is restricted.** We model Russian coverage from CAMS reanalysis and label it as modelled, not observed. A federation design that pretends this symmetry exists would fail on first contact.

### Digital Public Good alignment
Open licence · documented APIs · no PII collected from citizen reports beyond coarse geolocation · open standards throughout · reproducible from public data only.

---

## 9. GOOGLE STACK

| Component | Use |
|---|---|
| **Earth Engine** (Python API) | All satellite + reanalysis ingestion; MAIAC, S5P, ERA5, GFS, WorldPop |
| **BigQuery + BigQuery GIS** | Station time series, spatial joins, grid aggregation, validation queries |
| **Vertex AI** | Model training, managed endpoints, scheduled retraining pipelines |
| **Gemini API** | Multimodal citizen photo → AQI band; report triage and spam filtering |
| **Cloud Run** | Scheduled ingestion jobs + FastAPI inference service |
| **Pub/Sub** | Alert fan-out to authority console and citizen app |
| **Firebase** | Citizen app: Auth, Firestore, Cloud Messaging, Storage |
| **Cloud Storage** | COG raster tiles, model artifacts |
| **Maps Platform** | Base map and geocoding; Air Quality API used as an external **benchmark**, not a dependency |

---

## 10. REPOSITORY STRUCTURE

```
vaayu/
├── ingestion/
│   ├── cpcb_datagovin.py        # sanctioned CPCB resource poller
│   ├── openaq_v3.py             # harmonised cross-border ingest
│   ├── firms.py                 # VIIRS/MODIS active fire, bbox + MAP_KEY
│   ├── openmeteo.py             # CAMS baseline forecast
│   └── gee/
│       ├── maiac_aod.py         # MCD19A2 + QA bitmask decode + gap fill
│       ├── s5p.py               # NO2 / aerosol index
│       └── era5.py              # BLH, wind, RH, temperature
├── features/
│   ├── grid.py                  # 1km grid construction + static covariates
│   ├── align.py                 # spatiotemporal join: raster → station points
│   └── upwind_fire.py           # wind-aligned fire exposure feature
├── models/
│   ├── nowcast_xgb.py           # quantile regression surface
│   ├── forecast_lgbm.py         # multi-horizon
│   ├── baselines.py             # persistence, climatology, CAMS
│   └── attribution/
│       ├── cluster.py           # DBSCAN on fire detections
│       └── hysplit.py           # PySPLIT back-trajectories
├── evaluation/
│   ├── loso_cv.py               # leave-one-station-out
│   ├── blocked_cv.py            # forward-chaining temporal
│   ├── exceedance.py            # spike detection P/R/F1
│   └── calibration.py           # interval coverage diagrams
├── action/
│   ├── grap_rules.yaml          # versioned statutory thresholds
│   ├── rules_engine.py          # forecast → stage → mandated actions
│   └── worklist.py              # district enforcement ranking
├── api/                         # FastAPI service (Cloud Run)
├── console/                     # authority dashboard (React)
├── app/                         # citizen app (Firebase)
├── interop/
│   ├── sensorthings/            # FROST-Server config
│   └── stac/                    # catalogue definitions
└── notebooks/                   # EDA + validation reproduction
```

---

## 11. SETUP

### Prerequisites
- Python 3.11+, Node 20+
- Google Cloud project with Earth Engine, BigQuery, Vertex AI, Cloud Run enabled
- Free API keys: `api.data.gov.in`, OpenAQ v3, NASA FIRMS MAP_KEY, Gemini
- (Optional, for attribution) HYSPLIT + GDAS meteorology for PySPLIT

### Environment

```bash
cp .env.example .env
```

```
GCP_PROJECT_ID=
GEE_SERVICE_ACCOUNT_KEY=./secrets/gee-sa.json
DATA_GOV_IN_API_KEY=
OPENAQ_API_KEY=
FIRMS_MAP_KEY=
GEMINI_API_KEY=
DEMO_MODE=false
```

### Run

```bash
# install
pip install -r requirements.txt && npm install

# authenticate Earth Engine
earthengine authenticate

# build the training table (region + date range)
python -m ingestion.build_dataset --region ncr --start 2023-10-01 --end 2026-03-31

# train + validate
python -m models.nowcast_xgb --train
python -m evaluation.loso_cv --model nowcast   # prints the honest numbers

# serve
uvicorn api.main:app --host 0.0.0.0 --port 8080
npm run dev --prefix console
```

### Demo vs Live mode

`DEMO_MODE=true` substitutes cached fixtures for live API calls so the demo is deterministic offline. **Every fixture-backed value is badged `CACHED` in the UI.** In live mode, a failed upstream call surfaces `SOURCE_UNAVAILABLE` — it never silently falls back to synthetic data. Fabricated evidence presented as real telemetry is the failure mode we most want to avoid.

---

## 12. LIMITATIONS — STATED PLAINLY

1. **Nowcast accuracy is bounded.** Expect R² ≈ 0.6–0.75 daily at 1 km in Indian conditions. Sub-daily performance is materially worse. We report LOSO numbers, which are lower than random-split numbers.
2. **AOD gaps are non-random.** Cloud, snow, and extreme pollution all reduce retrieval. Coverage fraction is reported per grid cell; low-coverage cells carry wider intervals.
3. **Citizen photos yield bands, not concentrations.** Roughly R² ≈ 0.6 in published work, degrading with camera and illumination variation.
4. **HYSPLIT trajectories are single-particle approximations,** not full dispersion modelling. VAAYU does not run WRF-Chem or CMAQ — those require HPC and are outside a hackathon envelope. Attribution confidence is reported, not asserted.
5. **Night burning remains partially invisible.** Satellite overpass timing is a physical constraint. Citizen reporting mitigates but does not solve it.
6. **Statutory thresholds change.** GRAP was last revised 21.11.2025; Direction 95 dates from 01.10.2025. The rules engine is config-driven precisely so this stays maintainable, but deployed thresholds must be verified against CAQM's current schedule.
7. **The pilot is single-region.** Cross-country federation is demonstrated via OpenAQ multi-nation ingest and a SensorThings endpoint; it is not a live multi-national deployment.

---

## 13. ROADMAP

**Pilot (0–3 months)** — Deploy in one district with a nominated authority contact. Instrument the loop: were alerts opened, actioned, and did action correlate with subsequent exceedance reduction?

**Scale (3–9 months)** — National grid coverage; ingest low-cost sensor networks (Respirer/ATMAN) with co-location calibration and drift correction; publish the SensorThings endpoint publicly.

**Federate (9–18 months)** — Onboard a second BRICS node; Flower-based federated training on sensitive auxiliary layers; formal Digital Public Goods Alliance submission.

---

## 14. ATTRIBUTION

Built on public data from CPCB / MoEF&CC (GODL-India), OpenAQ (CC BY 4.0), NASA FIRMS and LP DAAC, ESA Copernicus Sentinel-5P, ECMWF ERA5, NOAA GFS and HYSPLIT/ARL, and Open-Meteo (CC BY 4.0). Statutory framework references: Commission for Air Quality Management in NCR and Adjoining Areas Act, 2021; GRAP schedule as revised 21.11.2025; CAQM Direction 95 dated 01.10.2025.

VAAYU is not affiliated with CPCB, CAQM, ISRO, or any government body. Outputs are decision support, not official measurements or legal determinations.

## LICENSE

_[MIT / Apache 2.0 — pick one; an OSI-approved licence is a prerequisite for Digital Public Good status]_
