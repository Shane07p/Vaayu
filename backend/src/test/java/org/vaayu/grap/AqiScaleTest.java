package org.vaayu.grap;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class AqiScaleTest {

    /**
     * Expected values computed from {@code pm25_to_aqi} in
     * {@code ml/src/vaayu_ml/models/forecast_lgbm.py}. The two implementations are
     * duplicated across languages, so this is what catches them drifting apart.
     */
    @ParameterizedTest
    @CsvSource({
        "0, 0",
        "15, 25",
        "30, 50",
        "60, 100",
        "90, 200",
        "120, 300",
        "250, 400",
        "500, 401",
    })
    void bandEndpointsMatchThePublishedCpcbScale(double pm25, int expectedAqi) {
        assertThat(AqiScale.fromPm25(pm25)).isEqualTo(expectedAqi);
    }

    @ParameterizedTest
    @CsvSource({
        "30.5, 100",
        "60.5, 200",
        "90.5, 300",
        "120.5, 400",
        "250.5, 500",
    })
    void concentrationsBetweenPublishedBandsDoNotReportSevere(double pm25, int ceiling) {
        // The published CPCB table is integer-banded (0-30, 31-60, ...), so these
        // values fell into a gap, matched nothing, and hit the severe fallback.
        // 30.5 micrograms is clean air; reporting it as AQI 500 maps to GRAP
        // Stage IV, which stops construction and closes schools.
        int aqi = AqiScale.fromPm25(pm25);

        assertThat(aqi).isNotEqualTo(500);
        assertThat(aqi).isLessThanOrEqualTo(ceiling);
    }

    @Test
    void cleanAirNeverReportsAsSevere() {
        // The specific regression: a hair over the first band boundary.
        assertThat(AqiScale.fromPm25(30.5)).isLessThan(110);
    }

    @Test
    void negativeConcentrationsClampToZeroRatherThanThrowing() {
        // A prediction interval's lower bound can fall below zero even though a
        // concentration cannot. Rejecting it would make a valid interval unwritable.
        assertThat(AqiScale.fromPm25(-12.5)).isZero();
    }

    @Test
    void extremeConcentrationsSaturateAtFiveHundred() {
        assertThat(AqiScale.fromPm25(250_000)).isEqualTo(500);
    }

    @Test
    void conversionIsMonotonic() {
        // A higher concentration must never produce a lower index, or an interval
        // could invert when both bounds are converted.
        int previous = -1;
        for (double pm25 = 0; pm25 <= 600; pm25 += 0.5) {
            int aqi = AqiScale.fromPm25(pm25);
            assertThat(aqi).isGreaterThanOrEqualTo(previous);
            previous = aqi;
        }
    }

    @Test
    void convertedIntervalStillContainsItsConvertedEstimate() {
        // The invariant chk_alert_interval_contains_estimate enforces in the
        // database. Converting each bound independently must preserve it.
        double pm25Low = 140.0;
        double pm25Mid = 166.0;
        double pm25High = 196.0;

        int low = AqiScale.fromPm25(pm25Low);
        int mid = AqiScale.fromPm25(pm25Mid);
        int high = AqiScale.fromPm25(pm25High);

        assertThat(low).isLessThanOrEqualTo(mid);
        assertThat(mid).isLessThanOrEqualTo(high);
    }
}
