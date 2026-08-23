import type { Alert, Forecast, GridPrediction, Station, WorklistItem } from "./schemas";
import { fixtureAqiFromPm25 } from "./aqi-fixture";

export const SEED_STATIONS: Station[] = [
  { id: 1, code: "SEED-DL-001", name: "Anand Vihar", city: "Delhi", state: "Delhi", lon: 77.3152, lat: 28.6469, source: "SEED" },
  { id: 2, code: "SEED-DL-002", name: "R K Puram", city: "Delhi", state: "Delhi", lon: 77.1855, lat: 28.5631, source: "SEED" },
  { id: 3, code: "SEED-DL-003", name: "Punjabi Bagh", city: "Delhi", state: "Delhi", lon: 77.1314, lat: 28.6741, source: "SEED" },
  { id: 4, code: "SEED-HR-001", name: "Gurugram Sector 51", city: "Gurugram", state: "Haryana", lon: 77.0688, lat: 28.4211, source: "SEED" },
  { id: 5, code: "SEED-UP-001", name: "Noida Sector 125", city: "Noida", state: "Uttar Pradesh", lon: 77.3250, lat: 28.5445, source: "SEED" },
];

// 20x20 cell grid across Delhi-NCR extent
export const SEED_GRID: GridPrediction[] = (() => {
  const cells: GridPrediction[] = [];
  let id = 1;
  for (let gx = 0; gx < 12; gx++) {
    for (let gy = 0; gy < 12; gy++) {
      const lon = 76.9 + gx * 0.05 + 0.025;
      const lat = 28.35 + gy * 0.04 + 0.02;
      // Variation in PM2.5 with a hotspot in North-West Delhi / NCR
      const distFromHotspot = Math.sqrt(Math.pow(lon - 77.15, 2) + Math.pow(lat - 28.65, 2));
      const basePm = Math.max(75, Math.min(290, 240 - distFromHotspot * 380 + (id % 25)));
      const cov = 0.55 + (id % 5) * 0.09;
      cells.push({
        gridCellId: id,
        code: `NCR-CELL-${String(id).padStart(4, "0")}`,
        lon: Number(lon.toFixed(4)),
        lat: Number(lat.toFixed(4)),
        ts: new Date().toISOString(),
        pm25Q10: Number((basePm * 0.78).toFixed(1)),
        pm25Q50: Number(basePm.toFixed(1)),
        pm25Q90: Number((basePm * 1.25).toFixed(1)),
        aqi: fixtureAqiFromPm25(basePm),
        coverageFraction: Number(cov.toFixed(2)),
        modelVersion: "VAAYU-XGB-v1",
        source: "SEED",
      });
      id++;
    }
  }
  return cells;
})();

export const SEED_FORECASTS: Forecast[] = [
  {
    id: 101,
    stationId: 1,
    issuedAt: new Date().toISOString(),
    horizonHours: 6,
    validAt: new Date(Date.now() + 6 * 3600000).toISOString(),
    pm25: 168,
    aqi: 337,
    ciLow: 145,
    ciHigh: 195,
    aqiLow: 320,
    aqiHigh: 358,
    baselinePersistence: 155,
    baselineCams: 162,
    modelVersion: "VAAYU-XGB-v1",
    source: "SEED",
  },
  {
    id: 102,
    stationId: 1,
    issuedAt: new Date().toISOString(),
    horizonHours: 24,
    validAt: new Date(Date.now() + 24 * 3600000).toISOString(),
    pm25: 218,
    aqi: 375,
    ciLow: 188,
    ciHigh: 254,
    aqiLow: 352,
    aqiHigh: 401,
    baselinePersistence: 155,
    baselineCams: 178,
    modelVersion: "VAAYU-XGB-v1",
    source: "SEED",
  },
  {
    id: 103,
    stationId: 1,
    issuedAt: new Date().toISOString(),
    horizonHours: 72,
    validAt: new Date(Date.now() + 72 * 3600000).toISOString(),
    pm25: 274,
    aqi: 401,
    ciLow: 232,
    ciHigh: 318,
    aqiLow: 386,
    aqiHigh: 401,
    baselinePersistence: 155,
    baselineCams: 210,
    modelVersion: "VAAYU-XGB-v1",
    source: "SEED",
  },
];

export const SEED_WORKLIST: WorklistItem[] = [
  {
    clusterCode: "PB-SGR-0412",
    tehsil: "Ajnala",
    district: "Amritsar",
    state: "Punjab",
    lon: 74.8723,
    lat: 31.634,
    detectionCount: 47,
    totalFrp: 812.5,
    impactScore: 0.89,
    impactRank: 1,
    downwindPopulation: 18400000,
    transportHours: 22.5,
    trajectoryConfidence: 0.87,
    consecutiveDaysUnactioned: 3,
    direction95Eligible: true,
  },
  {
    clusterCode: "HR-KTL-0198",
    tehsil: "Gharaunda",
    district: "Karnal",
    state: "Haryana",
    lon: 76.3869,
    lat: 29.6857,
    detectionCount: 23,
    totalFrp: 415.2,
    impactScore: 0.68,
    impactRank: 2,
    downwindPopulation: 9200000,
    transportHours: 14.0,
    trajectoryConfidence: 0.79,
    consecutiveDaysUnactioned: 1,
    direction95Eligible: false,
  },
  {
    clusterCode: "PB-FZR-0091",
    tehsil: "Zira",
    district: "Firozpur",
    state: "Punjab",
    lon: 74.9921,
    lat: 30.9782,
    detectionCount: 18,
    totalFrp: 320.0,
    impactScore: 0.54,
    impactRank: 3,
    downwindPopulation: 6400000,
    transportHours: 28.2,
    trajectoryConfidence: 0.72,
    consecutiveDaysUnactioned: 0,
    direction95Eligible: false,
  },
];

export const SEED_ALERTS: Alert[] = [
  {
    alertId: "VAAYU-2026-001",
    issuedAt: new Date(Date.now() - 3600000).toISOString(),
    horizonHours: 24,
    predictedAqi: 428,
    ciLow: 391,
    ciHigh: 461,
    recommendedGrapStage: "III",
    statutoryBasis: "CAQM Act 2021 Section 12 · GRAP Schedule (rev. 2025-11-21) Stage III (Severe Air Quality)",
    jurisdiction: ["Delhi-NCR", "DPCC", "GMDA", "UPPCB", "HSPCB"],
    mandatedActions: [
      "halt_non_essential_construction",
      "prohibit_bs3_petrol_bs4_diesel_lmvs",
      "intensify_mechanized_road_sweeping",
      "enforce_diesel_generator_restrictions",
      "stagger_public_office_working_hours",
    ],
    exposedPopulation: 18400000,
    modelVersion: "VAAYU-XGB-v1",
    evidenceSources: ["CPCB_STATIONS", "VIIRS_FIRMS", "ERA5_WIND_TRAJECTORY", "SENTINEL_5P_AOD"],
    source: "SEED",
  },
  {
    alertId: "VAAYU-2026-002",
    issuedAt: new Date(Date.now() - 14400000).toISOString(),
    horizonHours: 48,
    predictedAqi: 364,
    ciLow: 328,
    ciHigh: 398,
    recommendedGrapStage: "II",
    statutoryBasis: "CAQM GRAP Stage II Mandatory Protocol (Very Poor AQI 301–400)",
    jurisdiction: ["Gurugram", "Faridabad", "Noida", "Ghaziabad"],
    mandatedActions: [
      "daily_water_sprinkling_on_roads",
      "strict_vigil_on_garbage_burning",
      "ensure_uninterrupted_power_supply",
    ],
    exposedPopulation: 12100000,
    modelVersion: "VAAYU-XGB-v1",
    evidenceSources: ["CPCB_STATIONS", "CAMS_ENSEMBLE", "ERA5_METEO"],
    source: "SEED",
  },
];
