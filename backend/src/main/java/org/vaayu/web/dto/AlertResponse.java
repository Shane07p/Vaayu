package org.vaayu.web.dto;

import java.time.OffsetDateTime;
import java.util.List;

public record AlertResponse(
        String alertId,
        OffsetDateTime issuedAt,
        int horizonHours,
        int predictedAqi,
        int ciLow,
        int ciHigh,
        String recommendedGrapStage,
        String statutoryBasis,
        List<String> jurisdiction,
        List<String> mandatedActions,
        Long exposedPopulation,
        String modelVersion,
        List<String> evidenceSources,
        String source) {}
