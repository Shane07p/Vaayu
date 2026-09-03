package org.vaayu.web.dto;

import java.util.List;

/**
 * Measurements withheld while a sensor-quality concern is reviewed.
 *
 * <p>A holdout is not presented as a pollution reading. It is a transparent
 * accounting of what the product intentionally did not use and why.
 */
public record DataQualityResponse(int heldOutReadings, List<ReasonCount> reasons) {
    public record ReasonCount(String reason, int count) {}
}
