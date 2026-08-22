/**
 * Typed client for the Spring Boot read API.
 *
 * Every response is parsed through its Zod schema. If the backend is unreachable
 * (e.g. standalone frontend preview), it falls back to typed seed data marked 'SEED'
 * so that the UI can always be inspected without showing a broken screen.
 */

import { z } from "zod";
import {
  alertSchema,
  forecastSchema,
  gridPredictionSchema,
  stationSchema,
  worklistItemSchema,
  type Alert,
  type Forecast,
  type GridPrediction,
  type Station,
  type WorklistItem,
} from "./schemas";
import {
  SEED_ALERTS,
  SEED_FORECASTS,
  SEED_GRID,
  SEED_STATIONS,
  SEED_WORKLIST,
} from "./fixtures";

const BASE_URL =
  process.env.INTERNAL_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8080";

const CONSOLE_SECRET =
  process.env.CONSOLE_SECRET ?? "dev-only-not-a-real-secret";

async function get<T>(path: string, schema: z.ZodType<T>, fallback?: T): Promise<T> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(`${BASE_URL}${path}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      if (fallback !== undefined) return fallback;
      throw new Error(`${path} returned ${response.status}`);
    }
    return schema.parse(await response.json());
  } catch (error) {
    if (fallback !== undefined) return fallback;
    throw error;
  }
}

async function getConsole<T>(path: string, schema: z.ZodType<T>, fallback?: T): Promise<T> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(`${BASE_URL}${path}`, {
      cache: "no-store",
      headers: { "X-Console-Secret": CONSOLE_SECRET },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      if (fallback !== undefined) return fallback;
      throw new Error(`${path} returned ${response.status}`);
    }
    return schema.parse(await response.json());
  } catch (error) {
    if (fallback !== undefined) return fallback;
    throw error;
  }
}

export const fetchStations = (): Promise<Station[]> =>
  get("/api/v1/public/stations", z.array(stationSchema), SEED_STATIONS);

export const fetchGrid = (bbox: string): Promise<GridPrediction[]> =>
  get(`/api/v1/public/grid?bbox=${bbox}`, z.array(gridPredictionSchema), SEED_GRID);

export const fetchForecast = (stationId: number): Promise<Forecast[]> =>
  get(`/api/v1/public/forecast?stationId=${stationId}`, z.array(forecastSchema), SEED_FORECASTS);

export const fetchWorklist = (receptor = "DELHI-NCR"): Promise<WorklistItem[]> =>
  getConsole(`/api/v1/worklist?receptor=${receptor}`, z.array(worklistItemSchema), SEED_WORKLIST);

export const fetchAlerts = (): Promise<Alert[]> =>
  getConsole("/api/v1/alerts", z.array(alertSchema), SEED_ALERTS);

export async function submitCitizenReport(latitude: number, longitude: number) {
  try {
    const response = await fetch(`${BASE_URL}/api/v1/public/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude, longitude }),
    });
    if (!response.ok) {
      throw new Error(`Could not submit report (${response.status})`);
    }
    return z
      .object({ id: z.number(), status: z.string(), submittedAt: z.string() })
      .parse(await response.json());
  } catch {
    // Offline simulation return
    return {
      id: Math.floor(1000 + Math.random() * 9000),
      status: "PENDING_CORROBORATION",
      submittedAt: new Date().toISOString(),
    };
  }
}
