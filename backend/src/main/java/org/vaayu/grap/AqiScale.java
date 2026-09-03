package org.vaayu.grap;

/**
 * India CPCB PM2.5 to AQI conversion.
 *
 * <p>The forecast table stores {@code pm25} with a {@code ci_low}/{@code ci_high}
 * interval in micrograms per cubic metre, alongside an {@code aqi} point estimate.
 * The alert table stores {@code predicted_aqi} with its interval on the AQI scale.
 * Copying one interval into the other without converting produced alerts whose
 * stated interval did not contain their own point estimate, for example
 * "AQI 428, 80% interval 146 to 196".
 *
 * <p>That matters more here than in most systems. The interval is the project's
 * central honesty claim: an alert recommends statutory restrictions, and an
 * officer reading it needs the uncertainty to mean what it says.
 *
 * <p>The breakpoints below mirror {@code pm25_to_aqi} in
 * {@code ml/src/vaayu_ml/models/forecast_lgbm.py}. They are duplicated across two
 * languages, so a change to the CPCB scale must be made in both. The pairing is
 * asserted by {@code AqiScaleTest#matchesThePythonImplementation}.
 */
public final class AqiScale {

    /**
     * CPCB breakpoints: concentration low, concentration high, index low, index high.
     *
     * <p>The published CPCB table lists these as integer bands (0-30, 31-60,
     * 61-90, ...), which leaves gaps between them. PM2.5 is a continuous
     * measurement, so a concentration of 30.5 matched no band at all and fell
     * through to the "severe" fallback: 30.5 micrograms, genuinely clean air,
     * converted to AQI 500. Under GRAP that is Stage IV -- truck bans,
     * construction stoppage, school closures.
     *
     * <p>The bands are therefore contiguous on the concentration axis, with the
     * published index endpoints preserved. First match wins, so an exact
     * boundary value belongs to the lower band.
     */
    private static final double[][] BREAKPOINTS = {
        {0, 30, 0, 50},
        {30, 60, 51, 100},
        {60, 90, 101, 200},
        {90, 120, 201, 300},
        {120, 250, 301, 400},
        {250, 99_999, 401, 500},
    };

    private static final int MAX_AQI = 500;

    private AqiScale() {}

    /**
     * Convert a PM2.5 concentration in micrograms per cubic metre to a CPCB AQI.
     *
     * @param pm25 concentration; negatives are clamped to zero rather than rejected,
     *     because a prediction interval's lower bound can legitimately fall below
     *     zero even though a concentration cannot.
     * @return AQI in the range 0 to 500.
     */
    public static int fromPm25(double pm25) {
        double concentration = Math.max(0.0, pm25);

        for (double[] band : BREAKPOINTS) {
            double concentrationLow = band[0];
            double concentrationHigh = band[1];
            double indexLow = band[2];
            double indexHigh = band[3];

            if (concentration >= concentrationLow && concentration <= concentrationHigh) {
                double scaled = ((indexHigh - indexLow) / (concentrationHigh - concentrationLow))
                        * (concentration - concentrationLow)
                        + indexLow;
                return (int) scaled;
            }
        }
        return MAX_AQI;
    }
}
