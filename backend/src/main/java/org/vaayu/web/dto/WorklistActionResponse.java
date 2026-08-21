package org.vaayu.web.dto;

import java.time.OffsetDateTime;

public record WorklistActionResponse(String clusterCode, OffsetDateTime actionedAt, String actionedBy) {}
