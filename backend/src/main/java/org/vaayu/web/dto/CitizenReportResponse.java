package org.vaayu.web.dto;

import java.time.OffsetDateTime;

public record CitizenReportResponse(
        long id,
        OffsetDateTime submittedAt,
        String status,
        String band,
        Double confidence,
        boolean sourceUnavailable) {}
