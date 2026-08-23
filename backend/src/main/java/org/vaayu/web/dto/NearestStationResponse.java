package org.vaayu.web.dto;

import java.time.OffsetDateTime;

/**
 * The nearest station to a point, and what it last measured.
 *
 * <p>VAAYU's 1 km prediction surface covers Delhi-NCR. Everywhere else the
 * honest answer to "what is the air here" is the nearest real measurement and
 * how far away it is. The citizen map previously answered this by synthesising a
 * grid in the browser, which returned 156 ug/m3 and AQI 328 for every location on
 * Earth because the generator never used the coordinates it was given.
 *
 * @param distanceKm  how far the measurement is from the point asked about. Not
 *                    a caveat but the substance: the problem statement opens by
 *                    observing that cities miss hyper-local events, and a reader
 *                    told the nearest measurement is 23 km away has been told
 *                    something true and useful.
 * @param operator    who runs the station, as reported upstream, so a reader can
 *                    attribute the figure rather than take it from "VAAYU".
 * @param measuredAt  when the reading was taken, never when it was served.
 * @param stale       true when the reading is older than the freshness window.
 *                    Returned rather than withheld, with its real age, because
 *                    an old reading labelled old is information and an old
 *                    reading presented as current is not.
 */
public record NearestStationResponse(
        long stationId,
        String code,
        String name,
        String city,
        double lon,
        double lat,
        double distanceKm,
        double pm25,
        int aqi,
        OffsetDateTime measuredAt,
        boolean stale,
        String operator) {}
