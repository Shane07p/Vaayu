# Technical Build Plan: AI-Powered Federated Clean Air & Climate Resilience Platform (Problem Statement 02)

## TL;DR
- **Build a data-fusion + alerting platform, not another dashboard.** The winning wedge is plugging AI-derived hyper-local PM2.5 estimates and 24–72h spike forecasts directly into India's *existing* decision workflows — GRAP stage pre-invocation (CAQM) and the district-magistrate/CREAMS stubble-burning enforcement loop — rather than duplicating SAFAR, CPCB SAMEER, or Respirer's AtlasAQ.
- **All core data is free and accessible today**: CPCB AQI via the data.gov.in keyed API (resource `3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69`), OpenAQ v3 (CC BY 4.0), Sentinel-5P TROPOMI and MODIS MAIAC AOD (`MODIS/061/MCD19A2_GRANULES`) and ERA5 in Google Earth Engine, NASA FIRMS fire detections (~3-hour latency, free MAP_KEY), and Open-Meteo's free CAMS-based air-quality forecast API. The CPCB CCR station API (`app.cpcbccr.com`) is **unofficial/reverse-engineered** — use data.gov.in as the sanctioned route.
- **Calibrate claims to reality**: satellite AOD→PM2.5 with ML realistically gives R²≈0.5–0.75 daily at 1km; smartphone-photo PM2.5 gives R²≈0.6; "federated learning" is likely overkill — build a federated *data architecture* on OGC SensorThings API instead, and reserve true FL (Flower) as a forward-looking BRICS extension.

## Key Findings

1. **The gap is real and quantifiable.** India runs a sparse reference network. Per MoEF&CC (to Parliament, 2022), India has 1,296 ambient air quality monitoring stations across 473 cities in 28 states and 7 UTs (combined manual NAMP + real-time CAAQMS); the real-time CAAQMS subset is far smaller (~500+, shown as ~586 on public aggregators like AQICN), leaving most districts uncovered. Going to 1km requires satellite AOD + meteorology + ML fusion — well-established but bounded in accuracy.
2. **Data availability is not the bottleneck; fusion, validation, and action-attachment are.** Nearly every input layer is free. The differentiators are (a) rigorous spatial validation, (b) uncertainty quantification, and (c) mapping alerts to specific legal actions.
3. **Stubble burning has a mature government pipeline already.** ISRO/IARI-CREAMS standard protocol, Punjab Remote Sensing Centre, VIIRS/MODIS detection, 10,500 field functionaries in Punjab in 2025 (up from 9,500 in 2024, per The Tribune), plus 31 CPCB flying squads deployed Oct–Nov 2025 and a 1,700-strong Prali Protection Force per CAQM/MoEF&CC. Do not rebuild detection — add value with transport forecasting (HYSPLIT) and night-burning gap mitigation.
4. **Google stack alignment is strong and free-tier viable**: Earth Engine (free for research/noncommercial), Vertex AI, Gemini multimodal for citizen photos, BigQuery GIS, Cloud Run/Pub/Sub, Firebase. The Google Maps Air Quality API is both a competitor and a usable baseline component.
5. **BRICS interoperability is asymmetric**: only India offers a clean official keyed REST API. OpenAQ (CC BY 4.0) is the practical harmonization layer for India/China/Brazil/South Africa; Russia is a near-total open-data gap.

---

## 1. Datasets and Data Sources (highest-priority section)

### 1A. India ground-station air quality

**CPCB National Air Quality Index via data.gov.in (SANCTIONED API).**
- Contains: hourly-updated station-level readings (PM2.5, PM10, NO2, SO2, CO, O3, NH3) as Pollutant Min/Max/Avg with station lat/long, city, state.
- Endpoint: `https://api.data.gov.in/resource/3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69?api-key=YOUR_KEY&format=json&limit=...`. Catalog: data.gov.in/catalog/real-time-air-quality-index (publisher: CPCB, MoEF&CC). Filterable by state/city/station/pollutant_id.
- Resolution: point (station); ~hourly. Latency: ~1 hour.
- License/cost: Government Open Data License – India; free. Registration: free api.data.gov.in key (SSO/DigiLocker supported).
- Gotchas: fields are min/max/avg not a single value; coverage limited to CAAQMS locations; occasional stale "last update" timestamps.

**CPCB CCR / Central Control Room (`app.cpcbccr.com/ccr`).**
- The authoritative CAAQMS repository and manual bulk-download portal. Advanced search allows ~1 week of 15-min data per station/pollutant per query.
- **The underlying station API is NOT officially public** — programmatic access is via reverse-engineered community wrappers (`cpcbccr` PyPI package, CPCB_Data_Manager). Treat as unofficial/institutional and subject to breakage. Data hygiene needed: strip 0s, negatives, 999s, repeats.
- Historical compiled dataset (2015–2019, hourly, all stations) archived at Princeton DataSpace (Sharma & Mauzerall).

**OpenAQ API v3 (most accessible open route).**
- Aggregates and harmonizes CPCB data (and global). v1/v2 retired 31 Jan 2025 (return HTTP 410) — must use v3.
- Base: `https://api.openaq.org/v3`; requires free `X-API-Key` header. Key endpoints: `/v3/locations`, `/v3/sensors/{id}/measurements/hourly`, `/v3/parameters/{id}/latest`, bounding-box queries. Example: New Delhi station is location ID 8118.
- License: CC BY 4.0. Full archive on AWS S3 (`openaq-fetches`, no AWS account needed). Values in µg/m³ (good for interoperability).

**AQICN / WAQI API.**
- Real-time AQI, 100+ countries; CPCB network page lists ~586 India stations. Free token at aqicn.org/api (~1,000 req/min).
- Gotcha: values are converted to US EPA AQI by default (not raw concentrations); data marked "unvalidated" — use for display/context, not model training ground truth.

**State PCB feeds / SAFAR.** SAFAR (IITM/MoES) serves Delhi, Mumbai, Pune, Ahmedabad with 72h forecasts; data via safar.tropmet.res.in (no clean public API; screen-scrape or use displayed products). State PCB feeds are largely surfaced through CPCB CCR rather than independent APIs.

### 1B. Satellite atmospheric composition

**Sentinel-5P TROPOMI (NO2, SO2, CO, HCHO, O3, aerosol index).**
- Earth Engine collections: NRTI (near-real-time) `COPERNICUS/S5P/NRTI/L3_NO2` (and `_SO2`, `_CO`, `_HCHO`, `_AER_AI`, `_O3`), OFFL (offline) `COPERNICUS/S5P/OFFL/L3_NO2` etc.
- Native resolution ~3.5×5.5 km (nadir); regridded to 0.01°. Revisit ~daily (2-day catalog cadence). NRTI latency ~3 hours; OFFL a few days.
- Alternative access: Copernicus Data Space Ecosystem (free registration). Gotchas: negative retrieval values in clean areas (don't filter above −0.001 mol/m²); QA thresholding (Earth Engine filters tropospheric NO2 <75%, AER_AI <80%); column densities are vertically integrated, **not surface concentrations**.

**MODIS/VIIRS aerosol optical depth (MAIAC).**
- Earth Engine: `MODIS/061/MCD19A2_GRANULES` (v6.0 `MODIS/006/MCD19A2_GRANULES` deprecated). Bands: `Optical_Depth_047`, `Optical_Depth_055`, `AOD_Uncertainty`, `Column_WV`, `Injection_Height`, `AOD_QA`.
- Resolution 1 km, daily (Terra+Aqua combined). DOI 10.5067/MODIS/MCD19A2.061. Free via LP DAAC / Earthdata login.
- Gotchas: gaps under cloud/snow/high pollution; must decode `AOD_QA` bitmask; needs gap-filling for continuous fields.

**NASA FIRMS active fire (stubble burning).**
- Sensors: VIIRS S-NPP, NOAA-20, NOAA-21 (375 m), MODIS Terra/Aqua (1 km).
- API: `https://firms.modaps.eosdis.nasa.gov/api/area/` (CSV by bounding box, sensor, day range). Free MAP_KEY via `.../api/map_key/`; limit 5,000 transactions / 10 min.
- Latency: ~3 hours globally (NRT); Ultra-Real-Time <60s only US/Canada. VIIRS effectively ~12h for India passes; MODIS ~1–2 days for standard product. KML fire footprints are keyless.
- Gotcha: satellites pass ~13:30 and post-midnight; **farmers shift burning to evening/night to evade detection** — a documented, material limitation. Earth Engine also hosts a FIRMS collection.

**INSAT-3D/3DR, ISRO Bhuvan, MOSDAC.** Indian geostationary/AOD products via mosdac.gov.in and bhuvan.nrsc.gov.in. Accessibility: registration-gated, no clean REST API, slower/manual; useful for context and national-sovereignty framing but not for a fast hackathon pipeline. Flag as "available but friction-heavy."

**Sentinel-2 / Landsat (industrial context).** EE: `COPERNICUS/S2_SR_HARMONIZED` (10 m, 5-day), `LANDSAT/LC09/C02/T1_L2` (30 m, 16-day). Use for industrial-site/brick-kiln visual context, not gas concentrations.

### 1C. Meteorology and reanalysis

- **ERA5 hourly**: EE `ECMWF/ERA5/HOURLY` (~31 km, 1940–present); **ERA5-Land**: `ECMWF/ERA5_LAND/HOURLY` (~11 km, 1950–present, ~5-day lag). Also via Copernicus CDS. Key AQ features: boundary-layer height, 2m temp, wind u/v, RH, precipitation.
- **NOAA GFS**: EE `NOAA/GFS0P25` (0.25°, forecasts to 384h); free.
- **Open-Meteo (best hackathon choice)**: free, no key for non-commercial, CC BY 4.0. Weather forecast API plus **Air Quality API** (`https://air-quality-api.open-meteo.com/v1/air-quality`) serving PM2.5, PM10, NO2, O3, SO2, CO, dust, AOD from CAMS (11 km European + 40 km global). Ideal as a forecast baseline to beat and a gap-filler.
- **NASA MERRA-2**: EE `NASA/GSFC/MERRA/aer/2` aerosol reanalysis; useful for speciated aerosol.
- **CAMS**: global composition forecasts/reanalysis (EAC4) via Copernicus ADS; the engine behind Open-Meteo AQ. Free with ADS registration.
- **IMD**: authoritative Indian met, but data is **restricted/paid for bulk/programmatic use**; public products are display-oriented. Use ERA5/GFS/Open-Meteo instead for reproducibility.

### 1D. Emissions inventories
- **EDGAR** (EC JRC): global gridded anthropogenic emissions, ~0.1°, annual; free.
- **CEDS**: community emissions, sectoral, annual; free (GitHub/Zenodo).
- **SAFAR high-resolution emission inventories** for Indian megacities (published, IITM).
- India source-apportionment: TERI/ARAI Delhi studies; **Urban Emissions.info** (SIM-air; Guttikunda) — a key reusable Indian reference on source apportionment and access-to-data guidance.

### 1E. Population and exposure
- **WorldPop** (EE `WorldPop/GP/100m/pop`, 100 m annual) and **GHSL** (EE `JRC/GHSL/P2023A/GHS_POP`, 100 m).
- Indian admin boundaries: Survey of India / DataMeet / GADM shapefiles; district-level for DM-actionable alerts.
- Health burden: GBD (IHME) PM2.5 attributable mortality; the ACS *Environmental Science & Technology* 2023 India study (gap-filled MAIAC) quantified mortality-burden sensitivity to AOD sampling gaps (overestimation of ~93,986 deaths over 2017–2022 if gaps ignored).

### 1F. Low-cost sensor networks (actual India coverage)
- **Respirer Living Sciences (atmos) / AtlasAQ**: India's most significant low-cost network (~1,000+ devices; clients incl. Google, IITs, NEERI, WRI); AtlasAQ dashboard tracks NCAP cities and CAAQMS. Also powers IIT-Kanpur ATMAN "Project AMRIT" rural network. Partnered with Microsoft Research India for fault detection.
- **PurpleAir / Sensor.Community (Luftdaten) / AirGradient**: global APIs exist but India coverage is sparse/urban-hobbyist; not a reliable dense layer for Indian districts. State explicitly: **do not assume dense PurpleAir coverage in Indian constituencies.**
- OpenAQ also ingests some low-cost data (flagged separately in v3).

### 1G. BRICS cross-border open data (for interoperability framing)
- **China (CNEMC/MEE)**: National Urban AQ Real-time Platform (`air.cnemc.cn:18007`), ~1,600 national ("国控") stations (grew from 496 in 2013). **No official API** — scrape-only (undocumented POST `.../HourChangesPublish/GetAllAQIPublishLive`). Mirrored into OpenAQ (~1,495+ stations via community adapter) and WAQI. Chinese AQI uses HJ 633-2012 breakpoints.
- **Brazil**: decentralized. QUALAR (CETESB São Paulo, login-gated, R package `qualR`), MonitorAr (Rio), and the IEMA national aggregation (qualidadedoar.org.br) which supplies WHO (478 records, 82 localities, 2010–2019). OpenAQ ingests partial Brazilian data. No national real-time authority.
- **South Africa (SAAQIS)**: saaqis.environment.gov.za; 130+ government stations, 60+ live. Portal public; **API only on request** from DFFE. Mirrored on AQICN.
- **Russia (Roshydromet)**: ~600 posts in ~225 cities; **no open real-time API — reports are sold/paywalled, some data classified**; ~12 of 85 regions report no routine data. Effectively a gap; rely on CAMS-modeled fields.
- **Harmonization**: OpenAQ (CC BY 4.0, raw µg/m³) is the single most practical cross-border layer for four of five BRICS; WHO Ambient AQ Database v6.1 (7,182 settlements, annual means) for baselines. Standardize on raw concentrations, not each country's national AQI.

---

## 2. The Hyper-Local Gap (sparse stations → 1km)

The technical task: infer a continuous PM2.5 surface at ≤1km from sparse points + gridded covariates. Established methods and realistic accuracy:

- **Land Use Regression (LUR)**: regress concentrations on road density, land use, population, elevation. Cheap, interpretable; weak on temporal dynamics; typical R²≈0.5–0.7 for annual means.
- **Satellite AOD→PM2.5 (workhorse)**: MAIAC 1km AOD + meteorology + land use in ML. Published India numbers: Chennai coastal RF R²=0.53, RMSE 15.89 µg/m³ (met inclusion cut error ~17 µg/m³); NW-India data-scarce zone (Faridabad/Ghaziabad/Gurugram/GB Nagar) RF R²=0.71, RMSE 31.56 (vs MLR R²=0.62); Maharashtra 2023 RF R²=0.87, RMSE 12.57; and a national gap-filled MAIAC study (ACS EST 2023) achieving 5-fold CV R²=0.92, RMSE 11.8 µg/m³ on an **annual** scale. **Limitations to name explicitly**: AOD is a column measure — surface PM2.5 depends on boundary-layer height, humidity (hygroscopic growth), vertical aerosol profile, and speciation; monsoon degrades the AOD–PM relationship; cloud gaps require gap-filling. Naive linear AOD×constant conversion is a credibility red flag.
- **Spatiotemporal kriging / Gaussian processes**: principled uncertainty (kriging variance) but heavy compute and stationarity assumptions.
- **Geographically Weighted Regression (GWR)**: captures spatial non-stationarity in the AOD–PM relationship; common in Chinese/Indian studies.
- **ML (gradient boosting / RF)**: RF/XGBoost dominate the literature for tabular AOD+met fusion (numbers above). Best hackathon accuracy/effort ratio. Note correlation between nearby stations weakens beyond ~100 km (Maharashtra study).
- **Graph neural networks over station networks & ConvLSTM**: capture spatial dependency between monitors; more relevant for forecasting (§3).
- **Low-cost sensor calibration/drift**: co-locate with reference monitor; correct with RH/temperature-aware regression or RF. PM sensors drift and are RH-sensitive — uncalibrated data will bias any fused field.
- **Data fusion**: combine reference (accurate, sparse) + satellite (broad, gappy) + low-cost (dense, noisy) with a model that weights inputs by uncertainty.

**Realistic expectation to state**: 1km daily PM2.5 with R²≈0.6–0.75 and RMSE≈15–35 µg/m³ in Indian conditions is credible; sub-daily/hourly is harder; anything claiming R²>0.9 at hourly 1km without leave-one-station-out validation should be doubted.

---

## 3. Forecasting Air Quality Spikes

Feasibility-ranked for a hackathon:

- **Statistical baselines (must include)**: persistence (tomorrow = today), climatology, ARIMA/SARIMA. These are the baselines to beat; persistence is surprisingly strong at 6–24h.
- **Gradient boosting with met features (best effort/skill)**: XGBoost/LightGBM on lagged PM + ERA5/GFS met (BLH, wind, RH, temp) + FIRMS fire counts + day-of-year. Strong 24–72h skill, fast to train.
- **Sequence models**: LSTM/GRU, Temporal Fusion Transformer for multi-horizon + interpretable attention.
- **Graph spatiotemporal models**: STGCN, DCRNN, Graph WaveNet, PM2.5-GNN (domain-knowledge GNN, released code arXiv 2002.12898). On Delhi PM2.5, STGCN variants beat baselines: STGCN-B 1h MAE 10.53 / RMSE 6.92; STGCN-C 24h MAE 20.18 / RMSE 14.73 (Tech. Forecasting & Social Change). GC-LSTM reported R²≈0.72 at 72h. HYSPLIT-derived dynamic edges have been used to enrich the graph.
- **Chemistry transport models (WRF-Chem, CMAQ)**: physically rigorous, used by SAFAR; **require HPC and expert setup — not feasible to run in a hackathon**. Reference them; consume CAMS (itself a CTM) via Open-Meteo instead.

**Horizons/skill**: 6h and 24h are achievable with useful skill; 72h degrades (SAFAR reported PM2.5 Normalized Gross Error ~35% for Delhi, ~13–20% other cities in 2019–20). Report skill honestly per horizon.

**Stubble-burning episode prediction**: combine FIRMS fire counts (Punjab/Haryana) + upstream NW winds (ERA5/GFS) + boundary-layer height to forecast Delhi-NCR transport 24–48h ahead. This is the single highest-impact, most demonstrable forecasting use case.

**HYSPLIT for source attribution/transboundary transport**: NOAA ARL model; run backward trajectories from Delhi to attribute pollution to Punjab/Haryana fires (published studies use 120h back-trajectories with GDAS/GDAS0P5 met). **Programmatic access**: yes — via **PySPLIT** (Python API, GitHub mscross/pysplit) driving a local HYSPLIT install with GDAS/GFS met, or interactively via NOAA READY web. No hosted REST API; requires installing HYSPLIT + met files. For a hackathon, pre-compute representative back-trajectories for demo episodes.

---

## 4. Citizen-Sourced Data

**Smartphone-photo PM2.5 estimation — what's actually achievable:**
- Methods: dark channel prior + transmission estimation (He et al. 2010) as a physical feature; CNN regression on sky/haze images (VGG16, ResNet50, MobileNetV2 backbones); multi-view + meteorology fusion improves robustness.
- Published accuracy: fuzzy-NN and CNN approaches report R²≈0.62 on RGB photos (MDPI *Remote Sensing* 14(6):1515). Delhi-specific En3C-AQI-Net ensembles DeiT + dark-channel CNN + 1D-CNN on met. Public datasets: HVAQ (arXiv 2102.09332), APIN, PTIT_AQED.
- **Realistic limits (state explicitly)**: R²≈0.6 is typical; accuracy collapses with camera-pipeline variation, exposure/auto-white-balance, sun angle, and **cloud-vs-haze confusion** (rain/snow/overcast misread as pollution). Camera angle/illumination sensitivity is a known robustness gap. Best used for coarse AQI-band classification (good/moderate/poor) at scale, not precise µg/m³. Overclaiming here is a top credibility risk.
- **Gemini multimodal** (see §7) is a pragmatic hackathon route: prompt with sky photo + location + time to get a calibrated AQI-band estimate, rather than training a CNN from scratch.

**Crowdsourced low-cost sensor integration + trust problem:**
- Issues: spam/fake submissions, miscalibration, drift, spatial sampling bias (sensors cluster in affluent areas).
- Mitigations to cite: co-location calibration, RH correction, outlier/change-point detection (Respirer×MSR fault detection), reputation scoring, spatial cross-validation against reference monitors, and treating citizen data as *soft evidence* weighted by uncertainty — never as ground truth on par with CAAQMS.

---

## 5. "Federated" — What It Likely Means vs True FL

**Honest assessment**: the problem statement's "federated climate action platform … so BRICS nations can share predictive models" most plausibly means a **federated data architecture** (each nation retains sovereignty over its data; the platform interoperates and shares *models/insights*), not necessarily gradient-level federated learning. For a hackathon, **true FL is likely overkill and hard to demo convincingly**.

- **True FL frameworks**: Flower (framework-agnostic, research-friendly, hub-and-spoke, PyTorch/TF/JAX, supports horizontal + vertical FL, scales to many/simulated clients — best fit if you do FL), NVIDIA FLARE (enterprise, secure aggregation, admin console, GPU-centric, horizontal-only), TensorFlow Federated (TF-only, simulation-oriented). FedAvg is the canonical algorithm.
- **When FL makes sense here**: only if nations genuinely cannot share raw AQ data. But AQ data is largely *meant* to be public (OpenAQ already centralizes four of five BRICS). So FL solves a problem that mostly doesn't exist for open AQ data — say this plainly. FL's honest niche: sharing models trained on *sensitive* auxiliary data (e.g., proprietary industrial-emission or health data) across borders.
- **Recommended framing**: build a **federated data architecture** — standardized APIs so each country/state exposes its own data, and the platform federates queries and shares trained model weights as artifacts. Strengthen the Digital Public Good story with:
  - **OGC SensorThings API** (RESTful, JSON, MQTT, OData; open standard for IoT sensor data, built on Sensor Web Enablement and OGC/ISO 19156 Observations & Measurements; FROST-Server open-source reference implementation) — the natural standard for exposing air sensors interoperably.
  - **OGC API – Features** and **OGC API – EDR** (Environmental Data Retrieval) for gridded/coverage data.
  - **WMO standards** for met exchange; **netCDF / Zarr / Cloud-Optimized GeoTIFF** for gridded fields; **STAC** for cataloging satellite-derived layers.
  - **Digital Public Goods Alliance** requirements: open license, documented, no PII harm, DPG-Standard compliance — a strong positioning for MP judges and BRICS framing.

---

## 6. The Intervention Loop (critical — attach real actions to alerts)

**GRAP (Graded Response Action Plan), Delhi-NCR — exact triggers (revised 21.11.2025):**
- **Stage I "Poor" (AQI 201–300)**: 27 preventive actions — dust control, anti-smog guns, water sprinkling, bans on certain open burning.
- **Stage II "Very Poor" (AQI 301–400)**: 12-point plan — intensified dust/road measures, parking fees, enhanced public transport, DG-set restrictions.
- **Stage III "Severe" (AQI 401–450)**: 9-point plan — ban on non-essential construction/demolition, BS-III petrol/BS-IV diesel LMV restrictions, brick-kiln/stone-crusher closures, restrictions on inter-state diesel goods vehicles.
- **Stage IV "Severe+" (AQI >450)**: truck-entry bans, construction halts, possible staggered office timings and school measures.
- **Crucially, GRAP is now pre-emptive**: CAQM's GRAP Sub-Committee invokes stages *in advance* based on IMD/IITM dynamic-model forecasts (e.g., Jan 2026, Stage-III invoked as forecasts indicated Delhi's AQI would breach 400). **This is the exact hook for an AI forecast** — a skilled 24–72h AQI forecast feeds pre-invocation decisions.

**CAQM (Commission for Air Quality Management)**: statutory body under the 2021 Act, directly accountable to Parliament, apex authority over NCR + Punjab/Haryana/Rajasthan/UP; issues binding directives; runs the GRAP sub-committee.

**State PCBs / DPCC**: enforcement agents for GRAP; issue closure/penalty orders.

**District Magistrate / district-authority powers over stubble burning**: DMs/DCs receive geolocated fire alerts and can levy environmental compensation and initiate action. **CAQM issued Direction 95 on October 1, 2025, "authorising district authorities to file complaints before jurisdictional judicial magistrates in cases of inaction by officials responsible for enforcing measures to eliminate stubble burning"** (per MoEF&CC to Parliament). Punjab deployed 10,500 field functionaries in 2025 and a 1,700-strong Prali Protection Force; Punjab and Haryana together recorded >90% reduction in fire incidents vs 2022.

**Existing systems to integrate with, not duplicate:**
- **SAMEER app** (CPCB): public AQI + GRAP status + complaint lodging.
- **CREAMS/IARI + Punjab Remote Sensing Centre**: ISRO-IARI "Standard Protocol for Estimation of Crop Residue Burning Fire Events using Satellite Data" (developed by the Consortium for Research on Agroecosystem Monitoring and Modelling from Space) using VIIRS SNPP + MODIS Aqua; daily fire bulletins for Punjab/Haryana/Delhi/UP/MP/Rajasthan (Sep 15–Nov 30); data flows to PPCB + district heads; maps on ICAR KRISHI geoportal.
- **CAQM/CPCB dashboards**, SAFAR forecasts.

**Where AI plugs in (the pitch):** (1) feed forecast-based GRAP pre-invocation with hyper-local + longer-lead AQI predictions; (2) prioritize enforcement by predicting *which* fire clusters will most impact NCR (HYSPLIT transport), so limited field staff target high-impact fires; (3) mitigate the night-burning evasion gap by fusing VIIRS with citizen reports and NO2/AOD anomalies; (4) generate district-authority-ready alert packets (location, predicted exposure, recommended action, Direction-95 escalation trigger).

---

## 7. Google Cloud & Google AI Stack Alignment

- **Google Earth Engine**: Python API (`ee`), free for research/noncommercial (commercial requires paid EE on Google Cloud). Hosts every satellite/reanalysis layer above (S5P, MCD19A2, ERA5, GFS, FIRMS, WorldPop, GHSL). Authentication via service account for pipelines. This is the single strongest Google-alignment component.
- **BigQuery + BigQuery GIS**: store station time series + geospatial joins (ST_ functions); BQ public datasets. Good for the analytics/validation layer.
- **Vertex AI**: train XGBoost/LSTM/GNN; managed endpoints for inference; **AutoML Forecasting** for a fast strong baseline; Vertex Pipelines for retraining.
- **Gemini API (multimodal)**: ideal for the citizen-photo component — pass sky image + metadata for AQI-band estimation and for auto-triaging/validating citizen reports (spam detection, scene understanding). Lower effort than a custom CNN and very demo-friendly.
- **Cloud Run / Pub/Sub / Dataflow**: streaming ingestion (poll CPCB/OpenAQ/FIRMS → Pub/Sub → Dataflow → BigQuery); Cloud Run for stateless APIs and the inference service.
- **Firebase**: citizen mobile app (Auth, Firestore, Cloud Messaging for push alerts, Storage for photos) — fastest path to a working app.
- **Google Maps Platform Air Quality API**: per Google for Developers, "over 70 air quality indexes (AQIs)… over 100 countries with a resolution of 500 x 500 meters," with "over 50 million updates daily"; endpoints are Current Conditions, Hourly History (max 30 days), Heatmaps, and Forecast ("up to a maximum of 96 hours (4 days)"); it fuses stations, sensors, satellite, meteorology, land cover, and live traffic. **Both competitor and usable baseline** — use it as a comparison benchmark and optional fallback layer; pricing is per-call (billing required; the legacy $200/month Maps credit was replaced by free usage thresholds from Feb 28, 2025). Position your value-add as the *action/enforcement loop* Maps doesn't provide.
- **Project Air View / Aclima**: Google's mobile-sensor street-level mapping (with Aclima); cite as inspiration for mobile citizen sensing.
- **Credits**: Google Cloud free tier + $300 new-account credit; Google for Startups / education credits; EE free noncommercial. Enough to run a hackathon pilot.

---

## 8. Reference Architecture & Build Plan

**End-to-end architecture:**
1. **Ingestion**: scheduled Cloud Run jobs poll the data.gov.in CPCB API, OpenAQ v3, NASA FIRMS, Open-Meteo AQ+weather → Pub/Sub. Earth Engine Python tasks pull S5P NO2/AER_AI, MCD19A2 AOD, ERA5 BLH/wind over the AOI.
2. **Storage**: BigQuery (station time series, fire events, forecasts); Cloud Storage (COG/GeoTIFF raster tiles, citizen photos); Firestore (app state, alerts).
3. **Fusion/inference**:
   - Hyper-local nowcast: XGBoost on MAIAC AOD + ERA5 met + LUR features → 1km daily PM2.5 grid, with per-cell uncertainty (quantile regression).
   - Forecast: LightGBM/LSTM multi-horizon (6/24/72h) per station + optional STGCN on the station graph; features include FIRMS fire counts + upstream wind.
   - Citizen photo: Gemini multimodal → AQI band; used as soft evidence.
   - Source attribution: pre-computed PySPLIT/HYSPLIT back-trajectories for demo episodes.
4. **Alerting**: rules engine maps forecast AQI to GRAP stage thresholds → generates alert packets (Pub/Sub → Firebase Cloud Messaging + email/webhook to a mock authority dashboard).
5. **UI**: web dashboard (map of 1km PM2.5 + hotspots + fire overlay + forecast + trajectory) and Firebase citizen app (photo submit + local AQI + push alerts).

**Scope for a small student team (what to build vs stub):**
- **Actually build**: ingestion for 2–4 sources (CPCB via data.gov.in, OpenAQ, FIRMS, Open-Meteo); XGBoost 1km PM2.5 nowcast for one region (Delhi-NCR or the MP's constituency/district); 24h forecast with persistence + climatology baselines shown alongside; Gemini photo estimator; one map dashboard; GRAP-threshold alert rules; one pre-computed HYSPLIT stubble episode.
- **Stub/mock**: true federated learning (show architecture + a Flower simulation slide, not a live cross-border run); the authority "action taken" side (mock DM dashboard receiving the alert packet); full BRICS multi-country live feed (show OpenAQ China/Brazil/SA pulls as proof-of-interoperability, note Russia gap).

**Live demo should show**: (1) a 1km PM2.5 hotspot map that reveals a hidden hotspot between stations; (2) a 24–72h spike forecast with baseline comparison; (3) a stubble-fire cluster + HYSPLIT trajectory to Delhi + the auto-generated GRAP-stage alert packet (with Direction-95 escalation note); (4) a citizen photo → AQI estimate; (5) an OpenAQ cross-border pull demonstrating interoperability.

**Suggested tech stack**: Python, Earth Engine, XGBoost/LightGBM + PyTorch (optional STGCN via PyTorch Geometric Temporal), scikit-learn, BigQuery, Cloud Run, Pub/Sub, Firebase, Gemini API, Leaflet/deck.gl or Google Maps JS for the map, FastAPI on Cloud Run.

**Model choices & justification**: XGBoost for nowcast (best accuracy/effort on tabular AOD+met fusion, per Indian literature); LightGBM/LSTM for forecast; reserve GNN for a stretch goal (better spatial coupling but more effort). Gemini over custom CNN for photos (faster, robust enough for banded output).

**Evaluation methodology (signals rigor):**
- **Leave-one-station-out (spatial) CV** — the key credibility signal for spatial models; random splits leak spatial autocorrelation and inflate R².
- **Temporal holdout** — train on earlier period, test on later; block CV to respect temporal autocorrelation; never random-split time series.
- **Baselines to beat**: persistence + climatology (forecast); nearest-station + IDW/kriging (nowcast).
- **Metrics**: RMSE, MAE, R², plus **spike-detection metrics** (precision/recall/F1 for exceedance events, e.g., AQI>300) since spikes are the point; report per-horizon and per-season (monsoon vs winter).
- **Uncertainty**: report prediction intervals (quantile regression / kriging variance); calibration plots.

---

## 9. Prior Art & Competitive Landscape

- **SAFAR (IITM/MoES)**: CTM-based 72h forecasts, 4 metros; authoritative but limited-city, no hyper-local grid, no citizen layer. *Don't duplicate; complement with hyper-local + more cities.*
- **CPCB SAMEER**: official AQI + GRAP + complaints app. *Integration target, not competitor.*
- **Respirer / AtlasAQ**: India's leading low-cost network + NCAP dashboard. *Potential data partner; your value-add is forecasting + enforcement loop.*
- **Google Maps Air Quality API / BreezoMeter (acquired by Google)**: 500m fused AQ. *Strongest commercial analog; differentiate on action/enforcement and open-DPG framing.*
- **IQAir (AirVisual)**, **Plume Labs**, **AirNow (US)**: consumer AQ/forecast; not India-enforcement-focused.
- **OpenAQ**: open-data aggregator (a *dependency*, not competitor).
- **Berkeley Earth**: PM2.5 analysis/estimates; methodology reference.
- **Urban Emissions.info (Guttikunda)**: India emissions/source apportionment; reusable domain knowledge.
- **Climate TRACE**: satellite-derived emissions inventory; complementary emissions layer.
- **Google Project Air View + Aclima**: mobile street-level sensing; inspiration for citizen mobility.
- **Reusable code/datasets**: PM2.5-GNN (arXiv 2002.12898), PySPLIT (mscross/pysplit), FROST-Server (SensorThings), Earth Engine community AOD→PM2.5 notebooks, HVAQ dataset (arXiv 2102.09332).

---

## 10. Failure Modes & Credibility Risks

**What makes projects unconvincing to expert judges:**
- **Dashboards with no action attached** — the #1 failure. Fix: attach every alert to a GRAP stage / district-authority action / enforcement priority (incl. Direction-95 escalation).
- **Naive AOD→PM2.5 linear conversion** — ignores BLH, humidity, vertical profile. Fix: ML fusion with met covariates; acknowledge column-vs-surface.
- **No uncertainty quantification** — presenting point estimates as truth. Fix: prediction intervals, calibration.
- **Claiming accuracy without spatial validation** — random-split R² leaks autocorrelation. Fix: leave-one-station-out + spatial block CV; report the drop honestly.
- **Overclaiming citizen-photo accuracy** — R²≈0.6 reality vs "measure PM2.5 from a selfie." Fix: banded output + explicit limits.
- **Ignoring night-burning evasion** and satellite gaps as if detection is solved.
- **Rebuilding SAFAR/CREAMS** instead of integrating.
- **"Federated learning" as buzzword** with no justification.

**Technical choices that signal rigor**: leave-one-station-out CV; baselines (persistence/climatology/IDW) shown and beaten; per-season and per-horizon metrics; exceedance-event F1; uncertainty intervals; MAIAC QA bitmask handling; explicit column-vs-surface caveat; SensorThings/STAC interoperability; explicit integration points with GRAP/CAQM/CREAMS; honest BRICS data-gap disclosure (Russia).

---

## Recommendations

**Stage 1 (first 24h of hackathon) — De-risk data.** Get data.gov.in + OpenAQ + FIRMS + Open-Meteo keys working; pull one region's stations + MAIAC AOD + ERA5 in Earth Engine. *Benchmark to proceed*: a joined training table (station PM2.5 × AOD × met) covering ≥3 months.

**Stage 2 (middle) — Build and validate the models.** XGBoost 1km nowcast + 24h forecast with baselines; validate with leave-one-station-out and temporal holdout. *Benchmark*: beat persistence at 24h and IDW at nowcast; report honest R²/RMSE. If a GNN doesn't beat XGBoost quickly, drop it.

**Stage 3 (late) — Wire the intervention loop.** GRAP-threshold alert packets + mock district-authority dashboard + one HYSPLIT stubble episode + Gemini photo demo + OpenAQ cross-border pull. *Benchmark*: an end-to-end demo where a forecast triggers a stage-appropriate alert.

**Stage 4 (polish) — DPG/interoperability framing.** SensorThings endpoint stub, STAC catalog, uncertainty visualization, and the BRICS federation architecture slide (Flower as future work).

**Thresholds that change the plan**: if reference-station density in the target constituency is near zero, lean harder on satellite + Open-Meteo and frame as "first-ever local estimate"; if citizen-photo accuracy tests below R²≈0.5, demote it to a banded engagement feature; if HYSPLIT install is too slow, pre-compute trajectories offline.

---

## Caveats
- Accuracy numbers are from published studies in varying regions/seasons; your hackathon results will likely be lower — report honestly.
- The CPCB CCR station API and several Indian government feeds (IMD, MOSDAC, INSAT) are restricted, friction-heavy, or reverse-engineered; the data.gov.in resource is the only clean sanctioned Indian real-time route.
- Russia lacks open real-time AQ data; BRICS interoperability is genuinely asymmetric — disclose this rather than implying symmetric federation.
- GRAP triggers and CAQM procedures evolve (last revision 21.11.2025; Direction 95 dated 01.10.2025); verify current thresholds and directives at demo time.
- Google Maps AQ API and Earth Engine commercial terms have pricing/free-tier changes over time; confirm current limits before relying on them.