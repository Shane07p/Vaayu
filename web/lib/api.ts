/**
 * Typed client for the Spring Boot read API.
 *
 * Every response is parsed through its Zod schema, so a backend DTO change
 * surfaces as a parse error rather than as undefined rendering silently.
 *
 * RSC (server-side): uses INTERNAL_API_URL (http://backend:8080 in Docker)
 *                    to avoid NAT and to never expose the secret to the browser.
 * Client components: use NEXT_PUBLIC_API_URL (http://localhost:8080) via the host.
 */

import { z } from "zod";
import {
  alertSchema,
  forecastSchema,
  gridPredictionSchema,
  stationSchema,
  worklistItemSchema,
} from "./schemas";

// Server Components run inside Docker and reach the backend via the internal
// Docker network. Browser code reaches it via the publicly mapped port.
const BASE_URL =
  process.env.INTERNAL_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8080";

// CONSOLE_SECRET is only needed server-side and must never reach the browser.
const CONSOLE_SECRET =
  process.env.CONSOLE_SECRET ?? "dev-only-not-a-real-secret";

async function get<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const response = await fetch(${BASE_URL}, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(${path} returned );
  }
  return schema.parse(await response.json());
}

async function getConsole<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const response = await fetch(${BASE_URL}, {
    cache: "no-store",
    headers: { "X-Console-Secret": CONSOLE_SECRET },
  });
  if (!response.ok) {
    throw new Error(${path} returned );
  }
  return schema.parse(await response.json());
}

export const fetchStations = () =>
  get("/api/v1/public/stations", z.array(stationSchema));

export const fetchGrid = (bbox: string) =>
  get(/api/v1/public/grid?bbox=, z.array(gridPredictionSchema));

export const fetchForecast = (stationId: number) =>
  get(/api/v1/public/forecast?stationId=, z.array(forecastSchema));

export const fetchWorklist = (receptor = "DELHI-NCR") =>
  getConsole(/api/v1/worklist?receptor=, z.array(worklistItemSchema));

export const fetchAlerts = () =>
  getConsole("/api/v1/alerts", z.array(alertSchema));

export async function submitCitizenReport(latitude: number, longitude: number) {
  const response = await fetch(${BASE_URL}/api/v1/public/reports, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ latitude, longitude }),
  });
  if (!response.ok) {
    throw new Error(Could not submit report ());
  }
  return z
    .object({ id: z.number(), status: z.string(), submittedAt: z.string() })
    .parse(await response.json());
}
