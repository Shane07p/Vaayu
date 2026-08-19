package org.vaayu.web.dto;

import java.time.OffsetDateTime;

public record GridPredictionResponse(
        long gridCellId,
        String code,
        OffsetDateTime ts,
        double pm25Q10,
        double pm25Q50,
        double pm25Q90,
        double coverageFraction,
        String modelVersion,
        String source) {}
