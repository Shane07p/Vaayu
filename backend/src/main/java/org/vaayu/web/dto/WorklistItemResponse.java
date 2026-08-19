package org.vaayu.web.dto;

public record WorklistItemResponse(
        String clusterCode,
        String tehsil,
        String district,
        String state,
        double lon,
        double lat,
        int detectionCount,
        double totalFrp,
        double impactScore,
        int impactRank,
        Long downwindPopulation,
        Double transportHours,
        Double trajectoryConfidence,
        int consecutiveDaysUnactioned,
        boolean direction95Eligible) {}
