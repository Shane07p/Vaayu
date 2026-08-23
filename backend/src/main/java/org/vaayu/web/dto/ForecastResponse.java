package org.vaayu.web.dto;

import java.time.OffsetDateTime;

/**
 * @param aqiLow  CPCB AQI at {@code ciLow}
 * @param aqiHigh CPCB AQI at {@code ciHigh}
 *
 * <p>The interval is carried in AQI as well as ug/m3 because the citizen chart
 * plots AQI and was converting the bounds itself as {@code ciLow * 1.5}. That
 * invented a width for the model's own uncertainty. This project enforces
 * interval honesty in the schema -- {@code chk_alert_interval_contains_estimate}
 * rejects an interval that does not contain its estimate -- so a chart inventing
 * one in the browser is the same defect one layer up.
 *
 * <p>Converted from the stored bounds rather than widened: the AQI scale is
 * piecewise linear, so the interval's width in AQI is not a fixed multiple of
 * its width in ug/m3.
 */
public record ForecastResponse(
        long id,
        Long stationId,
        OffsetDateTime issuedAt,
        int horizonHours,
        OffsetDateTime validAt,
        double pm25,
        int aqi,
        double ciLow,
        double ciHigh,
        int aqiLow,
        int aqiHigh,
        double baselinePersistence,
        Double baselineCams,
        String modelVersion,
        String source) {}
