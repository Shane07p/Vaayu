package org.vaayu.web.dto;

import java.time.OffsetDateTime;

/**
 * A station and what it last measured.
 *
 * <p>{@code /stations} returns positions with no readings, so a map built on it
 * can place a marker but cannot label it. The citizen map used to fill that gap
 * with hardcoded values baked into a JSON file -- 5,699 of them, one figure per
 * place, frozen and unattributed. Those were removed, which left the map with no
 * numbers at all. This is what replaces them.
 *
 * @param aqi        CPCB value computed by AqiScale, so the map does not
 *                   reimplement the statutory scale.
 * @param measuredAt when the reading was taken, never when it was served.
 * @param stale      older than the freshness window. Returned with its real age
 *                   rather than withheld: an old reading labelled old is
 *                   information, an old reading shown as current is not.
 * @param operator   who runs the station, so the figure is attributable.
 */
public record StationReadingResponse(
        long stationId,
        String code,
        String name,
        String city,
        double lon,
        double lat,
        double pm25,
        int aqi,
        OffsetDateTime measuredAt,
        boolean stale,
        String operator) {}
