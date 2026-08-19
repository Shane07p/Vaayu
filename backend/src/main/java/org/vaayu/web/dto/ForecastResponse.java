package org.vaayu.web.dto;

import java.time.OffsetDateTime;

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
        double baselinePersistence,
        Double baselineCams,
        String modelVersion,
        String source) {}
