/**
 * Typed client for the Spring Boot read API.
 *
 * Every response is parsed through its Zod schema. Development can use typed seed
 * data for offline previews; production never replaces an unavailable upstream
 * response with data that could be mistaken for current telemetry.
 */

import { z } from "zod";
import {
  alertSchema,
  forecastSchema,
  cityRankingsSchema,
  gridPredictionSchema,
  narrativeSchema,
  nearestStationSchema,
  provenanceSchema,
  stationReadingSchema,
  stationSchema,
  worklistItemSchema,
  type Alert,
  type Forecast,
  type GridPrediction,
  type CityRankings,
  type NarrativeResult,
  type NearestStation,
  type Provenance,
  type Station,
  type StationReading,
  type WorklistItem,
} from "./schemas";
import {
  SEED_ALERTS,
  SEED_FORECASTS,
  SEED_GRID,
  SEED_STATIONS,
  SEED_WORKLIST,
} from "./fixtures";

const isProduction = process.env.NODE_ENV === "production";

function apiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const configured = process.env.NEXT_PUBLIC_API_URL;

    // Only an absolute URL is a base. A same-origin value such as "/api" is a
    // mount point, not a prefix to prepend: every path below already begins
    // "/api/v1/...", and the route handler at app/api/[...path] serves exactly
    // that. Prepending produced "/api/api/v1/..." on every browser request, and
    // the proxy forwarded it to the backend as "/api/api/v1/...", which is 404.
    //
    // Server-rendered pages were unaffected because they use INTERNAL_API_URL,
    // an absolute address. That is why the console pages looked fine while the
    // citizen map, which fetches from the browser, silently had no data.
    if (configured && /^https?:\/\//i.test(configured)) {
      return configured.replace(/\/$/, "");
    }
    return "";
  }

  const internalUrl = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (internalUrl) {
    return internalUrl;
  }
  if (!isProduction) {
    return "http://localhost:8080";
  }
  throw new Error("INTERNAL_API_URL is required when running the web service in production");
}

const CONSOLE_SECRET =
  process.env.CONSOLE_SECRET ?? "dev-only-not-a-real-secret";

/**
 * A read of stored data should be quick or not happen.
 */
const READ_TIMEOUT_MS = 2000;

/**
 * Generation is not a read.
 *
 * Producing four sentences of grounded prose measures at about twenty seconds
 * against the configured model. The two second read timeout aborted every
 * narrative before the model had answered, which the UI would then report as
 * the service being unavailable -- the same mistake the backend made with its
 * ten second read timeout, one layer up.
 */
const GENERATION_TIMEOUT_MS = 60000;

async function get<T>(
  path: string,
  schema: z.ZodType<T>,
  fallback?: T,
  timeoutMs: number = READ_TIMEOUT_MS,
): Promise<T> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(`${apiBaseUrl()}${path}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      if (!isProduction && fallback !== undefined) return fallback;
      throw new Error(`${path} returned ${response.status}`);
    }
    return schema.parse(await response.json());
  } catch (error) {
    if (!isProduction && fallback !== undefined) return fallback;
    throw error;
  }
}

async function getConsole<T>(
  path: string,
  schema: z.ZodType<T>,
  fallback?: T,
  timeoutMs: number = READ_TIMEOUT_MS,
): Promise<T> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(`${apiBaseUrl()}${path}`, {
      cache: "no-store",
      headers: { "X-Console-Secret": CONSOLE_SECRET },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      if (!isProduction && fallback !== undefined) return fallback;
      throw new Error(`${path} returned ${response.status}`);
    }
    return schema.parse(await response.json());
  } catch (error) {
    if (!isProduction && fallback !== undefined) return fallback;
    throw error;
  }
}

/**
 * No seed fallback, deliberately. Every other fetch may serve typed seed data in
 * development so a page still renders; this one reports whether the data is real.
 * A provenance call that quietly answered from fixtures would be the exact
 * failure it exists to expose.
 */
export const fetchProvenance = (): Promise<Provenance> =>
  get("/api/v1/public/provenance", provenanceSchema);

/**
 * Nearest measurement to a point, or null when nothing has ever reported.
 *
 * No seed fallback: this answers "is there real data near here", and a fixture
 * answering yes would defeat the question. A 404 is a valid answer meaning no
 * station has reported, and is returned as null rather than thrown.
 */
export async function fetchNearest(lat: number, lon: number): Promise<NearestStation | null> {
  const response = await fetch(
    `${apiBaseUrl()}/api/v1/public/nearest?lat=${lat}&lon=${lon}`,
    { cache: "no-store" },
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`nearest returned ${response.status}`);
  }
  return nearestStationSchema.parse(await response.json());
}

/**
 * No seed fallback. A fabricated ranking of the country's worst air is a claim
 * about real places, and the page renders an explicit failure instead.
 */
export const fetchCityRankings = (limit = 20): Promise<CityRankings> =>
  get(`/api/v1/public/cities/rankings?limit=${limit}`, cityRankingsSchema);

/**
 * Stations with their latest readings, for map labels.
 *
 * No seed fallback: an empty map is the truth when nothing has been ingested,
 * and fixture markers would be indistinguishable from measurements.
 */
export const fetchStationReadings = (): Promise<StationReading[]> =>
  get("/api/v1/public/stations/readings", z.array(stationReadingSchema));

/**
 * Stations that have a forecast.
 *
 * The forecast page took the first of all stations, which was fine while the
 * only stations were the five seeded ones. National ingestion added several
 * hundred, so that became a station in Jaipur with no forecast and the page
 * reported none available -- truthfully, about a station it should not have
 * asked.
 */
export const fetchForecastStations = (): Promise<Station[]> =>
  get("/api/v1/public/stations/forecastable", z.array(stationSchema), SEED_STATIONS);

/**
 * Officer briefing for an alert.
 *
 * No seed fallback. A fabricated briefing is the one thing this feature exists
 * to prevent, and a stand-in would be indistinguishable from a real one.
 */
export const fetchAlertNarrative = (
  alertId: string,
  lang: string,
): Promise<NarrativeResult> =>
  getConsole(
    `/api/v1/alerts/${encodeURIComponent(alertId)}/narrative?lang=${lang}`,
    narrativeSchema,
    undefined,
    GENERATION_TIMEOUT_MS,
  );

/** Plain-language advisory for a point, in the requested language. */
export const fetchAdvisory = (
  lat: number,
  lon: number,
  lang: string,
): Promise<NarrativeResult> =>
  get(
    `/api/v1/public/advisory?lang=${lang}&lat=${lat}&lon=${lon}`,
    narrativeSchema,
    undefined,
    GENERATION_TIMEOUT_MS,
  );

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

/**
 * Decimal places kept on a submitted position: two, about 1.1 km.
 *
 * Browser geolocation resolves to a few metres. A report pairs a position with a
 * photograph and a timestamp, and these reports often concern a neighbour's
 * burning, so an exact fix records who was standing where. Rounding here keeps
 * the precise position off the wire entirely, where it cannot be logged by a
 * proxy or the server.
 *
 * The backend rounds again on insert. That is not redundant: this rounding
 * protects the user, and the server's protects the guarantee against any caller
 * that does not round.
 */
const REPORT_COORDINATE_DECIMALS = 2;

function coarsen(coordinate: number): number {
  const scale = 10 ** REPORT_COORDINATE_DECIMALS;
  return Math.round(coordinate * scale) / scale;
}

export async function submitCitizenReport(latitude: number, longitude: number) {
  try {
    const response = await fetch(`${apiBaseUrl()}/api/v1/public/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: coarsen(latitude), longitude: coarsen(longitude) }),
    });
    if (!response.ok) {
      throw new Error(`Could not submit report (${response.status})`);
    }
    return z
      .object({ id: z.number(), status: z.string(), submittedAt: z.string() })
      .parse(await response.json());
  } catch (error) {
    // No fabricated receipt.
    //
    // This used to return a random id and a PENDING_CORROBORATION status
    // whenever the request failed outside production, so a citizen who
    // submitted a report saw a confirmation and an identifier for something
    // that was never stored. That was not hypothetical: every browser request
    // was 404ing on a doubled /api prefix, so the form had been reporting
    // success for submissions that never reached the server.
    //
    // A read may degrade to seed data in development; a write may not. There is
    // no honest stand-in for "we recorded your report".
    throw error;
  }
}
