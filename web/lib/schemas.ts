/**
 * Zod schemas mirroring the backend DTO records.
 *
 * These are the wire contract with the Spring Boot service. When a DTO changes
 * in `backend/src/main/java/org/vaayu/web/dto/`, change it here too — the parse
 * will fail loudly rather than silently rendering undefined.
 */

import { z } from "zod";

export const stationSchema = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  lon: z.number(),
  lat: z.number(),
  source: z.string(),
});

/** Always three quantiles plus coverage. The schema makes point estimates impossible. */
export const gridPredictionSchema = z.object({
  gridCellId: z.number(),
  code: z.string(),
  lon: z.number(),
  lat: z.number(),
  ts: z.string(),
  pm25Q10: z.number(),
  pm25Q50: z.number(),
  pm25Q90: z.number(),
  aqi: z.number(),
  coverageFraction: z.number(),
  modelVersion: z.string(),
  source: z.string(),
});

/** baselinePersistence is non-null: a forecast is never shown without what it must beat. */
export const forecastSchema = z.object({
  id: z.number(),
  stationId: z.number().nullable(),
  issuedAt: z.string(),
  horizonHours: z.number(),
  validAt: z.string(),
  pm25: z.number(),
  aqi: z.number(),
  ciLow: z.number(),
  ciHigh: z.number(),
  aqiLow: z.number(),
  aqiHigh: z.number(),
  baselinePersistence: z.number(),
  baselineCams: z.number().nullable(),
  modelVersion: z.string(),
  source: z.string(),
});

export const worklistItemSchema = z.object({
  clusterCode: z.string(),
  tehsil: z.string().nullable(),
  district: z.string().nullable(),
  state: z.string().nullable(),
  lon: z.number(),
  lat: z.number(),
  detectionCount: z.number(),
  totalFrp: z.number(),
  impactScore: z.number(),
  impactRank: z.number(),
  downwindPopulation: z.number().nullable(),
  transportHours: z.number().nullable(),
  trajectoryConfidence: z.number().nullable(),
  consecutiveDaysUnactioned: z.number(),
  /** Derived by the API, not stored: consecutiveDaysUnactioned >= 3. */
  direction95Eligible: z.boolean(),
});

export const alertSchema = z.object({
  alertId: z.string(),
  issuedAt: z.string(),
  horizonHours: z.number(),
  predictedAqi: z.number(),
  ciLow: z.number(),
  ciHigh: z.number(),
  recommendedGrapStage: z.enum(["I", "II", "III", "IV"]),
  statutoryBasis: z.string(),
  jurisdiction: z.array(z.string()),
  mandatedActions: z.array(z.string()),
  exposedPopulation: z.number().nullable(),
  modelVersion: z.string(),
  evidenceSources: z.array(z.string()),
  source: z.string(),
});

/**
 * Where the data on screen came from. Derived server-side from ingestion_run
 * and model_run; the console previously printed this from string literals and
 * claimed four live feeds while every row was seed data.
 */
export const feedProvenanceSchema = z.object({
  source: z.string(),
  liveName: z.string(),
  state: z.enum([
    "LIVE",
    "PARTIAL",
    "FIXTURE",
    "NEVER_RUN",
    "UNAVAILABLE",
    "FAILED",
    "RUNNING",
  ]),
  status: z.string().nullable(),
  rowCount: z.number().nullable(),
  lastRunAt: z.string().nullable(),
  error: z.string().nullable(),
});

export const provenanceSchema = z.object({
  feeds: z.array(feedProvenanceSchema),
  model: z.object({
    name: z.string().nullable(),
    version: z.string().nullable(),
    trainedAt: z.string().nullable(),
    isTrainedModel: z.boolean(),
  }),
});

export type FeedProvenance = z.infer<typeof feedProvenanceSchema>;
export type Provenance = z.infer<typeof provenanceSchema>;

/**
 * Nearest real measurement to a point. Used where the 1 km grid has no cell,
 * which is everywhere outside Delhi-NCR.
 */
export const nearestStationSchema = z.object({
  stationId: z.number(),
  code: z.string(),
  name: z.string(),
  city: z.string().nullable(),
  lon: z.number(),
  lat: z.number(),
  distanceKm: z.number(),
  pm25: z.number(),
  aqi: z.number(),
  measuredAt: z.string(),
  stale: z.boolean(),
  operator: z.string(),
});

export type NearestStation = z.infer<typeof nearestStationSchema>;

/** Cities ranked by their worst reporting station. */
export const cityRankingSchema = z.object({
  city: z.string(),
  stationCount: z.number(),
  worstStation: z.string(),
  lon: z.number(),
  lat: z.number(),
  pm25: z.number(),
  aqi: z.number(),
  measuredAt: z.string(),
  operator: z.string(),
});

export const cityRankingsSchema = z.object({
  cities: z.array(cityRankingSchema),
  /** Cities with no reading recent enough to rank. Surfaced, never dropped. */
  excluded: z.number(),
  /** Reporting stations whose name carries no city, so they cannot be ranked. */
  unattributedStations: z.number(),
});

export type CityRanking = z.infer<typeof cityRankingSchema>;
export type CityRankings = z.infer<typeof cityRankingsSchema>;

/** A station and its latest reading. What the map labels its markers with. */
export const stationReadingSchema = z.object({
  stationId: z.number(),
  code: z.string(),
  name: z.string(),
  city: z.string().nullable(),
  lon: z.number(),
  lat: z.number(),
  pm25: z.number(),
  aqi: z.number(),
  measuredAt: z.string(),
  stale: z.boolean(),
  operator: z.string(),
});

export type StationReading = z.infer<typeof stationReadingSchema>;

export type Station = z.infer<typeof stationSchema>;
export type GridPrediction = z.infer<typeof gridPredictionSchema>;
export type Forecast = z.infer<typeof forecastSchema>;
export type WorklistItem = z.infer<typeof worklistItemSchema>;
export type Alert = z.infer<typeof alertSchema>;
