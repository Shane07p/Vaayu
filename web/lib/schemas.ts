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
  ts: z.string(),
  pm25Q10: z.number(),
  pm25Q50: z.number(),
  pm25Q90: z.number(),
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

export type Station = z.infer<typeof stationSchema>;
export type GridPrediction = z.infer<typeof gridPredictionSchema>;
export type Forecast = z.infer<typeof forecastSchema>;
export type WorklistItem = z.infer<typeof worklistItemSchema>;
export type Alert = z.infer<typeof alertSchema>;
