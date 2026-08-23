package org.vaayu.web.dto;

import java.time.OffsetDateTime;

/**
 * @param aqi CPCB AQI for {@code pm25Q50}, computed server-side by
 *            {@code AqiScale}. Sent rather than derived in the browser because
 *            the citizen map was computing {@code pm25 / 250 * 500}, an invented
 *            linear scaling that is a whole band wrong at 120 ug/m3: it reports
 *            240, "Poor", where the statutory scale gives 300, "Very Poor".
 *            Reimplementing the breakpoints in TypeScript would leave two
 *            copies of a statutory scale free to drift, which is how the wind
 *            convention ended up defined twice, 180 degrees apart.
 */
public record GridPredictionResponse(
        long gridCellId,
        String code,
        double lon,
        double lat,
        OffsetDateTime ts,
        double pm25Q10,
        double pm25Q50,
        double pm25Q90,
        int aqi,
        double coverageFraction,
        String modelVersion,
        String source) {}
