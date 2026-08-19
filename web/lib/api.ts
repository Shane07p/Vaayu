/**
 * Typed client for the Spring Boot read API.
 *
 * Every response is parsed through its Zod schema, so a backend DTO change
 * surfaces as a parse error rather than as undefined rendering silently.
 */

import { z } from "zod";
import {
  alertSchema,
  forecastSchema,
  gridPredictionSchema,
  stationSchema,
  worklistItemSchema,
} from "./schemas";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

async function get<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }
  return schema.parse(await response.json());
}

export const fetchStations = () =>
  get("/api/v1/public/stations", z.array(stationSchema));

export const fetchGrid = (bbox: string) =>
  get(`/api/v1/public/grid?bbox=${bbox}`, z.array(gridPredictionSchema));

export const fetchForecast = (stationId: number) =>
  get(`/api/v1/public/forecast?stationId=${stationId}`, z.array(forecastSchema));

export const fetchWorklist = (receptor = "DELHI-NCR") =>
  get(`/api/v1/worklist?receptor=${receptor}`, z.array(worklistItemSchema));

export const fetchAlerts = () => get("/api/v1/alerts", z.array(alertSchema));

export async function submitCitizenReport(latitude: number, longitude: number) {
  const response = await fetch(`${BASE_URL}/api/v1/public/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ latitude, longitude }),
  });
  if (!response.ok) {
    throw new Error(`Could not submit report (${response.status})`);
  }
  return z.object({ id: z.number(), status: z.string(), submittedAt: z.string() }).parse(await response.json());
}
