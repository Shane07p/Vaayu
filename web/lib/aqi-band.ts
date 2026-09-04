/**
 * The CPCB band an AQI falls in, and the colour that goes with it.
 *
 * One implementation, because there were two and they disagreed. The AQI itself
 * is computed server-side by AqiScale against CPCB breakpoints and arrives on
 * every reading; this only names the band that number already sits in. Never
 * recompute an AQI here -- see docs/ORIENTATION.md §2.5.
 *
 * What was here before was the United States EPA scale: the names Good,
 * Moderate, Unhealthy for Sensitive Groups, Unhealthy, Very Unhealthy,
 * Hazardous, broken at 50/100/150/200/300. Those names were applied to a CPCB
 * number, so two things were wrong at once.
 *
 * The thresholds differ, not only the words. CPCB has no boundary at 150, and
 * its top band starts at 401 rather than 301. A reading of 150 is Moderate to
 * CPCB and was shown as "Unhealthy for Sensitive Groups"; a reading of 350 is
 * Very Poor and was shown as "Hazardous". An Indian reader comparing our figure
 * against a government bulletin would have found the band disagreeing with the
 * number, and health guidance keyed to the band would have been attached to the
 * wrong readings.
 */

export type BandKey = "good" | "satisfactory" | "moderate" | "poor" | "veryPoor" | "severe";

/**
 * Upper bound of each CPCB band, inclusive, in AQI.
 *
 * 0-50 Good, 51-100 Satisfactory, 101-200 Moderate, 201-300 Poor,
 * 301-400 Very Poor, 401+ Severe. The index is capped at 500 upstream, so the
 * final band is open-ended here rather than carrying a bound it cannot exceed.
 */
const BAND_MAX: ReadonlyArray<readonly [number, BandKey]> = [
  [50, "good"],
  [100, "satisfactory"],
  [200, "moderate"],
  [300, "poor"],
  [400, "veryPoor"],
];

/** Ordered worst-last, for rendering a scale. */
export const BANDS: readonly BandKey[] = [
  "good",
  "satisfactory",
  "moderate",
  "poor",
  "veryPoor",
  "severe",
];

/** The AQI range each band covers, for showing a reader where a figure sits. */
export const BAND_RANGE: Record<BandKey, readonly [number, number]> = {
  good: [0, 50],
  satisfactory: [51, 100],
  moderate: [101, 200],
  poor: [201, 300],
  veryPoor: [301, 400],
  severe: [401, 500],
};

export function bandFor(aqi: number): BandKey {
  for (const [max, band] of BAND_MAX) {
    if (aqi <= max) return band;
  }
  return "severe";
}

/**
 * Colours run green through red, and are held here rather than beside the
 * markers so the map, the cards and any scale cannot drift apart.
 *
 * Chosen to stay legible on the dark surface and to remain distinguishable to
 * the most common forms of colour blindness by lightness as well as hue -- the
 * band is always written next to the number, so colour never carries the
 * meaning alone.
 */
export const BAND_COLOR: Record<BandKey, string> = {
  good: "#34d399",
  satisfactory: "#a3e635",
  moderate: "#fbbf24",
  poor: "#fb923c",
  veryPoor: "#f87171",
  severe: "#b91c1c",
};

export const colorFor = (aqi: number): string => BAND_COLOR[bandFor(aqi)];
