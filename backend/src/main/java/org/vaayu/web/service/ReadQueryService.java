package org.vaayu.web.service;

import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.vaayu.grap.AqiScale;
import org.vaayu.web.dto.AlertResponse;
import org.vaayu.web.dto.ForecastResponse;
import org.vaayu.web.dto.CityRankingResponse;
import org.vaayu.web.dto.GridPredictionResponse;
import org.vaayu.web.dto.NearestStationResponse;
import org.vaayu.web.dto.ProvenanceResponse;
import org.vaayu.web.dto.StationReadingResponse;
import org.vaayu.web.dto.StationResponse;
import org.vaayu.web.dto.WorklistActionResponse;
import org.vaayu.web.dto.WorklistItemResponse;

/** Read-only SQL projection layer; Flyway, rather than Hibernate, owns this schema. */
@Service
@Transactional(readOnly = true)
public class ReadQueryService implements ReadQueryOperations {
    private final NamedParameterJdbcTemplate jdbc;
    private final CacheManager cacheManager;

    public ReadQueryService(NamedParameterJdbcTemplate jdbc, CacheManager cacheManager) {
        this.jdbc = jdbc;
        this.cacheManager = cacheManager;
    }

    @Cacheable("stations")
    public List<StationResponse> stations() {
        return jdbc.query(
                """
                SELECT id, code, name, city, state, ST_X(geom::geometry) AS lon,
                       ST_Y(geom::geometry) AS lat, source
                FROM station ORDER BY name
                """,
                (rs, row) -> new StationResponse(
                        rs.getLong("id"), rs.getString("code"), rs.getString("name"),
                        rs.getString("city"), rs.getString("state"), rs.getDouble("lon"),
                        rs.getDouble("lat"), rs.getString("source")));
    }

    @Cacheable(value = "grid", key = "#minLon + ':' + #minLat + ':' + #maxLon + ':' + #maxLat")
    public List<GridPredictionResponse> grid(double minLon, double minLat, double maxLon, double maxLat) {
        return jdbc.query(
                """
                SELECT g.id AS grid_cell_id, g.code, ST_X(g.centroid::geometry) AS lon,
                       ST_Y(g.centroid::geometry) AS lat, p.ts, p.pm25_q10, p.pm25_q50,
                       p.pm25_q90, p.coverage_fraction, p.model_version, p.source
                FROM grid_cell g
                JOIN LATERAL (
                    SELECT * FROM grid_prediction p
                    WHERE p.grid_cell_id = g.id
                    ORDER BY p.ts DESC, p.id DESC LIMIT 1
                ) p ON TRUE
                -- && is the bounding-box overlap operator and is the only spatial
                -- predicate here that can use idx_grid_cell_centroid. ST_Within on
                -- g.centroid::geometry casts every row before comparing, so the
                -- index could not be used and the query sequentially scanned the
                -- whole grid, then ran one LATERAL probe per cell. That was 400
                -- cells when this was written and is 5,929 now.
                --
                -- ST_Within also excludes points lying exactly on the envelope
                -- edge, silently dropping boundary cells from the map. && is
                -- inclusive, which is the behaviour a viewport query wants.
                WHERE g.centroid::geometry && ST_MakeEnvelope(:minLon, :minLat, :maxLon, :maxLat, 4326)
                """,
                Map.of("minLon", minLon, "minLat", minLat, "maxLon", maxLon, "maxLat", maxLat),
                (rs, row) -> {
                    double median = rs.getDouble("pm25_q50");
                    return new GridPredictionResponse(
                            rs.getLong("grid_cell_id"), rs.getString("code"), rs.getDouble("lon"),
                            rs.getDouble("lat"), timestamp(rs, "ts"),
                            rs.getDouble("pm25_q10"), median, rs.getDouble("pm25_q90"),
                            // One implementation of the CPCB scale, here.
                            AqiScale.fromPm25(median),
                            rs.getDouble("coverage_fraction"), rs.getString("model_version"),
                            rs.getString("source"));
                });
    }

    @Cacheable(value = "forecast", key = "#stationId")
    public List<ForecastResponse> forecast(long stationId) {
        return jdbc.query(
                """
                SELECT f.* FROM forecast f
                WHERE f.station_id = :stationId
                  AND f.issued_at = (
                    SELECT MAX(issued_at) FROM forecast WHERE station_id = :stationId
                  )
                ORDER BY f.horizon_hours
                """,
                Map.of("stationId", stationId),
                (rs, row) -> {
                    double ciLow = rs.getDouble("ci_low");
                    double ciHigh = rs.getDouble("ci_high");
                    return new ForecastResponse(
                            rs.getLong("id"), nullableLong(rs, "station_id"),
                            timestamp(rs, "issued_at"), rs.getInt("horizon_hours"),
                            timestamp(rs, "valid_at"), rs.getDouble("pm25"),
                            rs.getInt("aqi"), ciLow, ciHigh,
                            // Converted, not scaled. See ForecastResponse.
                            AqiScale.fromPm25(ciLow), AqiScale.fromPm25(ciHigh),
                            rs.getDouble("baseline_persistence"),
                            nullableDouble(rs, "baseline_cams"),
                            rs.getString("model_version"), rs.getString("source"));
                });
    }

    @Cacheable(value = "worklist", key = "#receptor")
    public List<WorklistItemResponse> worklist(String receptor) {
        return jdbc.query(
                """
                SELECT c.id AS cluster_id, c.code, c.tehsil, c.district, c.state, ST_X(c.centroid::geometry) AS lon,
                       ST_Y(c.centroid::geometry) AS lat, c.detection_count, c.total_frp,
                       i.impact_score, i.impact_rank, i.downwind_population, i.transport_hours,
                       i.trajectory_confidence, i.consecutive_days_unactioned
                FROM fire_cluster_impact i JOIN fire_cluster c ON c.id = i.fire_cluster_id
                WHERE i.receptor = :receptor ORDER BY i.impact_rank
                """,
                Map.of("receptor", receptor),
                (rs, row) -> new WorklistItemResponse(
                        rs.getLong("cluster_id"), rs.getString("code"), rs.getString("tehsil"), rs.getString("district"),
                        rs.getString("state"), rs.getDouble("lon"), rs.getDouble("lat"),
                        rs.getInt("detection_count"), rs.getDouble("total_frp"),
                        rs.getDouble("impact_score"), rs.getInt("impact_rank"),
                        nullableLong(rs, "downwind_population"), nullableDouble(rs, "transport_hours"),
                        nullableDouble(rs, "trajectory_confidence"),
                        rs.getInt("consecutive_days_unactioned"),
                        rs.getInt("consecutive_days_unactioned") >= 3));
    }

    public List<AlertResponse> alerts() {
        return jdbc.query(
                """
                SELECT * FROM alert ORDER BY issued_at DESC, id DESC LIMIT 50
                """,
                (rs, row) -> new AlertResponse(
                        rs.getString("alert_id"), timestamp(rs, "issued_at"), rs.getInt("horizon_hours"),
                        rs.getInt("predicted_aqi"), rs.getInt("ci_low"), rs.getInt("ci_high"),
                        rs.getString("recommended_grap_stage"), rs.getString("statutory_basis"),
                        textArray(rs, "jurisdiction"), textArray(rs, "mandated_actions"),
                        nullableLong(rs, "exposed_population"), rs.getString("model_version"),
                        textArray(rs, "evidence_sources"), rs.getString("source")));
    }

    public Optional<AlertResponse> alert(String alertId) {
        List<AlertResponse> alerts = jdbc.query(
                """
                SELECT * FROM alert WHERE alert_id = :alertId
                """,
                Map.of("alertId", alertId),
                (rs, row) -> new AlertResponse(
                        rs.getString("alert_id"), timestamp(rs, "issued_at"), rs.getInt("horizon_hours"),
                        rs.getInt("predicted_aqi"), rs.getInt("ci_low"), rs.getInt("ci_high"),
                        rs.getString("recommended_grap_stage"), rs.getString("statutory_basis"),
                        textArray(rs, "jurisdiction"), textArray(rs, "mandated_actions"),
                        nullableLong(rs, "exposed_population"), rs.getString("model_version"),
                        textArray(rs, "evidence_sources"), rs.getString("source")));
        return alerts.stream().findFirst();
    }

    /**
     * Record an enforcement action and drop the cached worklist afterwards.
     *
     * <p>The cache is evicted from an after-commit callback rather than with
     * {@code @CacheEvict}. The transaction and cache interceptors have no defined
     * ordering between them, so the annotation can evict while the transaction is
     * still open: a concurrent read then repopulates the cache from pre-commit
     * rows and serves them for the full five-minute TTL.
     *
     * <p>What that looks like to a user is a cluster someone has just actioned
     * still showing consecutive_days_unactioned at its old value, and therefore
     * still displaying the Direction 95 escalation badge. That is a false claim
     * that a statutory escalation threshold has been crossed, so it is worth the
     * extra few lines to evict only once the data is actually visible.
     */
    private void evictWorklistAfterCommit() {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            clearWorklistCache();
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                clearWorklistCache();
            }
        });
    }

    private void clearWorklistCache() {
        Cache cache = cacheManager.getCache("worklist");
        if (cache != null) {
            cache.clear();
        }
    }

    @Transactional
    public WorklistActionResponse recordWorklistAction(long clusterId, String receptor, String actionedBy) {
        List<WorklistActionResponse> actions = jdbc.query(
                """
                UPDATE fire_cluster_impact impact
                SET consecutive_days_unactioned = 0,
                    last_actioned_at = now(),
                    actioned_by = :actionedBy
                FROM fire_cluster cluster
                WHERE impact.fire_cluster_id = cluster.id
                  AND impact.fire_cluster_id = :clusterId
                  AND impact.receptor = :receptor
                RETURNING cluster.code, impact.last_actioned_at, impact.actioned_by
                """,
                Map.of("clusterId", clusterId, "receptor", receptor, "actionedBy", actionedBy),
                (rs, row) -> new WorklistActionResponse(
                        rs.getString("code"), timestamp(rs, "last_actioned_at"), rs.getString("actioned_by")));
        evictWorklistAfterCommit();
        if (actions.isEmpty()) {
            throw new java.util.NoSuchElementException("worklist cluster was not found");
        }
        return actions.getFirst();
    }

    /**
     * How old a reading may be before it is labelled stale.
     *
     * <p>Six hours, matched to what the upstream actually does. This was three,
     * on the assumption that CPCB and DPCC stations publish hourly. They do, but
     * OpenAQ mirrors them with a lag: measured across a national run, no
     * station's newest reading was under 120 minutes old, 217 sat between 120
     * and 180 minutes, and 44 were already past 180. Three hours therefore
     * marked a fifth of correctly-working stations stale on arrival, and cities
     * dropped out of search and rankings between one page load and the next.
     *
     * <p>The question this window asks is whether a station is still reporting,
     * not whether a reading is instantaneous. It hides nothing: every reading
     * carries its measured time, and a stale one is dimmed rather than removed.
     *
     * <p>Kept equal to {@code openaq_latest.FRESHNESS} so ingestion and the read
     * API cannot disagree about what "currently reporting" means.
     */
    private static final Duration FRESHNESS = Duration.ofHours(6);

    /**
     * Nearest station to a point that has ever reported a PM2.5 value.
     *
     * <p>Not cached: the argument space is every coordinate a visitor might
     * send, so a cache would grow without bound while almost never being hit.
     */
    public Optional<NearestStationResponse> nearest(double lat, double lon) {
        List<NearestStationResponse> found = jdbc.query(
                """
                SELECT s.id, s.code, s.name, s.city,
                       ST_X(s.geom::geometry) AS lon, ST_Y(s.geom::geometry) AS lat,
                       ST_Distance(s.geom, :point::geography) AS distance_m,
                       r.ts, r.pm25, r.source
                FROM station s
                JOIN LATERAL (
                    SELECT ts, pm25, source FROM station_reading
                    WHERE station_id = s.id AND pm25 IS NOT NULL
                    ORDER BY ts DESC LIMIT 1
                ) r ON TRUE
                -- <-> is the KNN distance operator and uses idx_station_geom.
                -- ORDER BY ST_Distance would compute a distance for every
                -- station before sorting, which is a full scan of the table.
                ORDER BY s.geom <-> :point::geography
                LIMIT 1
                """,
                Map.of("point", "SRID=4326;POINT(" + lon + " " + lat + ")"),
                (rs, row) -> {
                    double pm25 = rs.getDouble("pm25");
                    OffsetDateTime measuredAt = timestamp(rs, "ts");
                    boolean stale = measuredAt == null
                            || measuredAt.isBefore(OffsetDateTime.now().minus(FRESHNESS));
                    return new NearestStationResponse(
                            rs.getLong("id"), rs.getString("code"), rs.getString("name"),
                            rs.getString("city"), rs.getDouble("lon"), rs.getDouble("lat"),
                            // Metres to kilometres, one decimal. Reporting metres
                            // would imply a precision the station siting does not have.
                            Math.round(rs.getDouble("distance_m") / 100.0) / 10.0,
                            pm25, AqiScale.fromPm25(pm25), measuredAt, stale,
                            rs.getString("source"));
                });

        return found.stream().findFirst();
    }

    /**
     * Cities ranked by their worst current station reading.
     *
     * <p>Only cities with a reading inside {@link #FRESHNESS} are ranked. The
     * rest are counted and returned as {@code excluded} rather than dropped
     * silently, because a list of the worst air in the country that quietly
     * omits the places it could not measure reads as a statement about those
     * places too.
     */
    public CityRankingResponse cityRankings(int limit) {
        OffsetDateTime cutoff = OffsetDateTime.now().minus(FRESHNESS);

        List<CityRankingResponse.CityRanking> ranked = jdbc.query(
                """
                WITH latest AS (
                    SELECT s.city, s.name, s.source, r.pm25, r.ts,
                           ST_X(s.geom::geometry) AS lon, ST_Y(s.geom::geometry) AS lat
                    FROM station s
                    JOIN LATERAL (
                        SELECT pm25, ts FROM station_reading
                        WHERE station_id = s.id AND pm25 IS NOT NULL
                        ORDER BY ts DESC LIMIT 1
                    ) r ON TRUE
                    WHERE s.city IS NOT NULL
                ),
                fresh AS (
                    SELECT * FROM latest WHERE ts >= :cutoff
                ),
                -- The worst station in each city, and how many reported there.
                -- DISTINCT ON keeps the row the figure came from, so the station
                -- can be named rather than the city standing for itself.
                worst AS (
                    SELECT DISTINCT ON (city)
                           city, name, source, pm25, ts, lon, lat,
                           COUNT(*) OVER (PARTITION BY city) AS station_count
                    FROM fresh
                    ORDER BY city, pm25 DESC
                )
                SELECT city, name, source, pm25, ts, lon, lat, station_count
                FROM worst
                ORDER BY pm25 DESC
                LIMIT :limit
                """,
                Map.of("cutoff", cutoff, "limit", limit),
                (rs, row) -> {
                    double pm25 = rs.getDouble("pm25");
                    return new CityRankingResponse.CityRanking(
                            rs.getString("city"), rs.getInt("station_count"),
                            rs.getString("name"), rs.getDouble("lon"), rs.getDouble("lat"),
                            pm25, AqiScale.fromPm25(pm25),
                            timestamp(rs, "ts"), rs.getString("source"));
                });

        Integer excluded = jdbc.queryForObject(
                """
                SELECT COUNT(DISTINCT s.city)
                FROM station s
                JOIN LATERAL (
                    SELECT ts FROM station_reading
                    WHERE station_id = s.id AND pm25 IS NOT NULL
                    ORDER BY ts DESC LIMIT 1
                ) r ON TRUE
                WHERE s.city IS NOT NULL
                  AND s.city NOT IN (
                      SELECT s2.city FROM station s2
                      JOIN LATERAL (
                          SELECT ts FROM station_reading
                          WHERE station_id = s2.id AND pm25 IS NOT NULL
                          ORDER BY ts DESC LIMIT 1
                      ) r2 ON TRUE
                      WHERE s2.city IS NOT NULL AND r2.ts >= :cutoff
                  )
                """,
                Map.of("cutoff", cutoff),
                Integer.class);

        // Stations that report but cannot be attributed to a city. They are
        // absent from the ranking, so this count is their only trace.
        Integer unattributed = jdbc.queryForObject(
                """
                SELECT COUNT(*)
                FROM station s
                JOIN LATERAL (
                    SELECT ts FROM station_reading
                    WHERE station_id = s.id AND pm25 IS NOT NULL
                    ORDER BY ts DESC LIMIT 1
                ) r ON TRUE
                WHERE s.city IS NULL AND r.ts >= :cutoff
                """,
                Map.of("cutoff", cutoff),
                Integer.class);

        return new CityRankingResponse(
                ranked,
                excluded == null ? 0 : excluded,
                unattributed == null ? 0 : unattributed);
    }

    /**
     * Every station that has a reading, with that reading.
     *
     * <p>Stations that have never reported are omitted rather than returned with
     * a null value: a marker with no number is indistinguishable on a map from
     * one whose number failed to load.
     */
    public List<StationReadingResponse> stationReadings() {
        return jdbc.query(
                """
                SELECT s.id, s.code, s.name, s.city,
                       ST_X(s.geom::geometry) AS lon, ST_Y(s.geom::geometry) AS lat,
                       r.pm25, r.ts, r.source
                FROM station s
                JOIN LATERAL (
                    SELECT pm25, ts, source FROM station_reading
                    WHERE station_id = s.id AND pm25 IS NOT NULL
                    ORDER BY ts DESC LIMIT 1
                ) r ON TRUE
                ORDER BY r.pm25 DESC
                """,
                (rs, row) -> {
                    double pm25 = rs.getDouble("pm25");
                    OffsetDateTime measuredAt = timestamp(rs, "ts");
                    boolean stale = measuredAt == null
                            || measuredAt.isBefore(OffsetDateTime.now().minus(FRESHNESS));
                    return new StationReadingResponse(
                            rs.getLong("id"), rs.getString("code"), rs.getString("name"),
                            rs.getString("city"), rs.getDouble("lon"), rs.getDouble("lat"),
                            pm25, AqiScale.fromPm25(pm25), measuredAt, stale,
                            rs.getString("source"));
                });
    }

    /**
     * Stations that actually have a forecast.
     *
     * <p>The forecast page used to take the first station from {@link #stations()},
     * which was fine while the only stations were the five seeded ones. National
     * ingestion added several hundred, so the alphabetically first station became
     * one in Jaipur that has never been forecast, and the page correctly but
     * uselessly reported that no forecast was available. Asking for a station
     * that can answer is the fix; widening the page's error message would not
     * have been.
     */
    @Cacheable("forecastStations")
    public List<StationResponse> forecastStations() {
        return jdbc.query(
                """
                SELECT DISTINCT s.id, s.code, s.name, s.city, s.state,
                       ST_X(s.geom::geometry) AS lon, ST_Y(s.geom::geometry) AS lat, s.source
                FROM station s
                JOIN forecast f ON f.station_id = s.id
                ORDER BY s.name
                """,
                (rs, row) -> new StationResponse(
                        rs.getLong("id"), rs.getString("code"), rs.getString("name"),
                        rs.getString("city"), rs.getString("state"), rs.getDouble("lon"),
                        rs.getDouble("lat"), rs.getString("source")));
    }

    /**
     * Feeds this system ingests, declared rather than discovered.
     *
     * <p>A feed that has never run leaves no row in {@code ingestion_run}, and
     * "no row" has to be reportable as "not connected" rather than being
     * invisible. Discovering the list from the table would silently omit exactly
     * the feeds a reader most needs to know are missing.
     *
     * <p>Names match {@code ingestion.source.Source.name} on the Python side.
     */
    private static final Map<String, String> KNOWN_FEEDS = new LinkedHashMap<>() {{
        put("CPCB", "CPCB CAAQMS");
        put("OPENAQ", "OpenAQ v3 (backfill)");
        put("OPENAQ_LATEST", "OpenAQ v3 (current)");
        put("FIRMS", "NASA FIRMS VIIRS/MODIS");
        put("OPEN_METEO", "Open-Meteo CAMS baseline");
        put("GEE_MAIAC_AOD", "MODIS MAIAC AOD");
        put("GEE_S5P", "Sentinel-5P TROPOMI");
        put("GEE_ERA5", "ERA5 reanalysis");
    }};

    /**
     * Not cached, deliberately. This is the freshness indicator; serving it from
     * a cache would let it report a staleness it no longer has, or hide one it
     * has acquired. It is a single indexed query.
     */
    public ProvenanceResponse provenance() {
        Map<String, ProvenanceResponse.FeedProvenance> latest = new LinkedHashMap<>();
        jdbc.query(
                """
                SELECT DISTINCT ON (source)
                       source, mode, status, row_count, started_at, error
                FROM ingestion_run
                ORDER BY source, started_at DESC
                """,
                rs -> {
                    String source = rs.getString("source");
                    latest.put(source, new ProvenanceResponse.FeedProvenance(
                            source,
                            KNOWN_FEEDS.getOrDefault(source, source),
                            feedState(rs.getString("status"), rs.getString("mode")),
                            rs.getString("status"),
                            nullableInt(rs, "row_count"),
                            timestamp(rs, "started_at"),
                            rs.getString("error")));
                });

        List<ProvenanceResponse.FeedProvenance> feeds = KNOWN_FEEDS.entrySet().stream()
                .map(entry -> latest.getOrDefault(
                        entry.getKey(),
                        // Never run. Reported as such rather than omitted, and
                        // never as a working feed.
                        new ProvenanceResponse.FeedProvenance(
                                entry.getKey(), entry.getValue(), "NEVER_RUN",
                                null, null, null, null)))
                .toList();

        return new ProvenanceResponse(feeds, latestModel());
    }

    /** Maps a recorded run onto what a reader needs to know about the feed. */
    private static String feedState(String status, String mode) {
        if (status == null) {
            return "NEVER_RUN";
        }
        return switch (status) {
            case "SOURCE_UNAVAILABLE" -> "UNAVAILABLE";
            // Some units succeeded and some did not. Distinct from LIVE, which
            // would hide the gap, and from UNAVAILABLE, which would deny the
            // readings that did arrive.
            case "PARTIAL" -> "PARTIAL";
            case "FAILED" -> "FAILED";
            case "RUNNING" -> "RUNNING";
            // Only a successful run may report the mode it ran in. A failed live
            // attempt is not a live feed.
            case "SUCCESS" -> "LIVE".equals(mode) ? "LIVE" : "FIXTURE";
            default -> status;
        };
    }

    private ProvenanceResponse.ModelProvenance latestModel() {
        List<ProvenanceResponse.ModelProvenance> models = jdbc.query(
                """
                SELECT model_name, model_version, trained_at
                FROM model_run ORDER BY trained_at DESC LIMIT 1
                """,
                (rs, row) -> {
                    String name = rs.getString("model_name");
                    // Derived, not asserted: a seeded database cannot describe
                    // itself as a trained model.
                    boolean trained = !"seed".equalsIgnoreCase(name);
                    return new ProvenanceResponse.ModelProvenance(
                            name, rs.getString("model_version"),
                            timestamp(rs, "trained_at"), trained);
                });
        return models.isEmpty()
                ? new ProvenanceResponse.ModelProvenance(null, null, null, false)
                : models.get(0);
    }

    private static Integer nullableInt(ResultSet rs, String column) throws SQLException {
        int value = rs.getInt(column);
        return rs.wasNull() ? null : value;
    }

    private static OffsetDateTime timestamp(ResultSet rs, String column) throws SQLException {
        return rs.getObject(column, OffsetDateTime.class);
    }

    private static Long nullableLong(ResultSet rs, String column) throws SQLException {
        long value = rs.getLong(column);
        return rs.wasNull() ? null : value;
    }

    private static Double nullableDouble(ResultSet rs, String column) throws SQLException {
        double value = rs.getDouble(column);
        return rs.wasNull() ? null : value;
    }

    private static List<String> textArray(ResultSet rs, String column) throws SQLException {
        Array array = rs.getArray(column);
        return array == null ? List.of() : List.of((String[]) array.getArray());
    }
}
