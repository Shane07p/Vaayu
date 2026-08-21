package org.vaayu.web.dto;

import jakarta.validation.constraints.Size;

/** Optional display name for the console operator who recorded an action. */
public record WorklistActionRequest(@Size(max = 200) String actionedBy) {}
