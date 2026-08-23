/**
 * CPCB PM2.5 to AQI, for locally generated development fixtures only.
 *
 * The API returns the AQI with every prediction and forecast, computed by
 * `AqiScale` in the backend. Application code must use that value. This exists
 * solely because the seed fixtures synthesise their PM2.5 procedurally in the
 * browser, so there is no server round trip in which to convert it.
 *
 * It is a third copy of the scale, after `org.vaayu.grap.AqiScale` and
 * `pm25_to_aqi` in `ml/src/vaayu_ml/models/forecast_lgbm.py`. That is a real
 * cost, accepted here only because these values never leave a developer's
 * machine: `fetchGrid` and `fetchForecast` fall back to fixtures in development
 * and never in production. If this drifts, a local preview is wrong and nothing
 * a user sees is.
 *
 * Do not import this outside `fixtures.ts` and the store's synthetic grid.
 */

/**
 * Concentration low, concentration high, index low, index high.
 *
 * Contiguous on the concentration axis, deliberately. The published CPCB table
 * lists integer bands (0-30, 31-60, ...) which leave gaps, so 30.5 -- clean air
 * -- matched nothing and fell through to the severe fallback, AQI 500. Kept
 * identical to the Java and Python tables.
 */
const BREAKPOINTS: readonly (readonly [number, number, number, number])[] = [
  [0, 30, 0, 50],
  [30, 60, 51, 100],
  [60, 90, 101, 200],
  [90, 120, 201, 300],
  [120, 250, 301, 400],
  [250, 99_999, 401, 500],
];

const MAX_AQI = 500;

/** Negatives clamp to zero: an interval's lower bound may fall below zero even though a concentration cannot. */
export function fixtureAqiFromPm25(pm25: number): number {
  const concentration = Math.max(0, pm25);

  for (const [concentrationLow, concentrationHigh, indexLow, indexHigh] of BREAKPOINTS) {
    if (concentration >= concentrationLow && concentration <= concentrationHigh) {
      const scaled =
        ((indexHigh - indexLow) / (concentrationHigh - concentrationLow)) *
          (concentration - concentrationLow) +
        indexLow;
      return Math.trunc(scaled);
    }
  }
  return MAX_AQI;
}
