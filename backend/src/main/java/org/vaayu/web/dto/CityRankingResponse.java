package org.vaayu.web.dto;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Cities ranked by their worst current station reading.
 *
 * @param cities   ranked worst first
 * @param excluded how many cities were left out for having no reading inside the
 *                 freshness window. Carried because a "worst air today" list that
 *                 silently omits the cities it could not measure implies they were
 *                 checked and found cleaner. The number is the difference between
 *                 a ranking and a claim about the country.
 * @param unattributedStations reporting stations whose name carries no city, so
 *                 they cannot be grouped into one and are absent from the ranking
 *                 entirely. Disclosed for the same reason as {@code excluded},
 *                 and because the cost of not disclosing it was demonstrated:
 *                 thirty-eight stations were unattributed before V905, and one
 *                 of them held the worst reading in the country.
 */
public record CityRankingResponse(
        List<CityRanking> cities, int excluded, int unattributedStations) {

    /**
     * @param stationCount how many stations in this city reported. The headline
     *                     takes the worst of them rather than an average: an
     *                     average across a city hides the neighbourhood that is
     *                     actually dangerous, and this list exists to surface it.
     * @param worstStation which station the figure came from, so the reader can
     *                     see the city is not being characterised by one number
     *                     without knowing where it was taken.
     */
    public record CityRanking(
            String city,
            int stationCount,
            String worstStation,
            // Position of the worst station, so a reader can open the map there.
            // The city has no coordinate of its own here; a city is a grouping
            // of stations, not an entity with a centre.
            double lon,
            double lat,
            double pm25,
            int aqi,
            OffsetDateTime measuredAt,
            String operator) {}
}
