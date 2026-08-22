package org.vaayu.web.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcOperations;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.vaayu.grap.AqiScale;
import org.vaayu.grap.GrapProperties;
import org.vaayu.grap.GrapService;

/** Converts the strongest latest forecast into an auditable, idempotent GRAP alert. */
@Service
public class AlertWriterService {
    private static final DateTimeFormatter ALERT_TIME =
            DateTimeFormatter.ofPattern("yyyyMMddHHmmss").withZone(ZoneOffset.UTC);
    private static final String[] NCR_JURISDICTION = {"DPCC", "GMDA", "UPPCB"};

    private final NamedParameterJdbcOperations jdbc;
    private final GrapService grap;
    private final ObjectMapper objectMapper;

    public AlertWriterService(NamedParameterJdbcOperations jdbc, GrapService grap, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.grap = grap;
        this.objectMapper = objectMapper;
    }

    @Scheduled(cron = "0 0 */6 * * *")
    @Transactional
    public void writeScheduledAlerts() {
        latestCandidate().ifPresent(this::writeAlert);
    }

    private Optional<ForecastCandidate> latestCandidate() {
        return jdbc.query(
                        """
                        SELECT f.id, f.issued_at, f.horizon_hours, f.aqi, f.ci_low, f.ci_high,
                               f.model_version, f.source
                        FROM forecast f
                        -- The subquery must carry the same horizon filter as the
                        -- outer query. Without it, a batch that issued only 6h
                        -- forecasts sets MAX(issued_at) to a timestamp for which no
                        -- 24h or 72h row exists, the candidate set comes back empty,
                        -- and the scheduled job issues no alert at all -- silently,
                        -- because "no candidate" and "nothing to warn about" look
                        -- identical from here.
                        WHERE f.horizon_hours IN (24, 72)
                          AND f.issued_at = (
                              SELECT MAX(issued_at) FROM forecast
                              WHERE horizon_hours IN (24, 72)
                          )
                        ORDER BY f.aqi DESC, f.horizon_hours ASC, f.id ASC
                        LIMIT 1
                        """,
                        (rs, row) -> new ForecastCandidate(
                                rs.getLong("id"), rs.getObject("issued_at", OffsetDateTime.class),
                                rs.getInt("horizon_hours"), rs.getInt("aqi"), rs.getDouble("ci_low"),
                                rs.getDouble("ci_high"), rs.getString("model_version"), rs.getString("source")))
                .stream()
                .findFirst();
    }

    private void writeAlert(ForecastCandidate forecast) {
        Optional<GrapProperties.Stage> stage = grap.stageFor(forecast.aqi());
        if (stage.isEmpty()) {
            return;
        }
        Optional<DominantCluster> dominant = stage.get().stage().equals("I")
                ? Optional.empty()
                : dominantCluster();
        String alertId = "VAAYU-" + ALERT_TIME.format(forecast.issuedAt()) + "-" + forecast.id();
        String dominantSource = dominant.map(this::dominantSourceJson).orElse(null);
        String escalation = escalationJson(dominant.orElse(null));
        String[] evidenceSources = dominant.isPresent()
                ? new String[] {forecast.source(), dominant.get().source()}
                : new String[] {forecast.source()};
        MapSqlParameterSource parameters = new MapSqlParameterSource()
                .addValue("alertId", alertId)
                .addValue("issuedAt", forecast.issuedAt())
                .addValue("horizonHours", forecast.horizonHours())
                .addValue("predictedAqi", forecast.aqi())
                // forecast.ci_low/ci_high bound pm25 in ug/m3; alert.ci_low/ci_high
                // bound predicted_aqi on the AQI scale. Copying them across
                // unconverted produced intervals that did not contain their own
                // point estimate, such as "AQI 428, interval 146 to 196".
                .addValue("ciLow", AqiScale.fromPm25(forecast.ciLow()))
                .addValue("ciHigh", AqiScale.fromPm25(forecast.ciHigh()))
                .addValue("stage", stage.get().stage())
                .addValue("basis", grap.statutoryBasis(stage.get()))
                .addValue("jurisdiction", String.join(",", NCR_JURISDICTION))
                .addValue("actions", String.join(",", stage.get().mandatedActions()))
                .addValue("population", dominant.map(DominantCluster::downwindPopulation).orElse(null))
                .addValue("dominantSource", dominantSource)
                .addValue("escalation", escalation)
                .addValue("modelVersion", forecast.modelVersion())
                .addValue("evidenceSources", String.join(",", evidenceSources))
                .addValue("source", forecast.source());
        List<Long> inserted = jdbc.query(
                """
                INSERT INTO alert (
                    alert_id, issued_at, horizon_hours, predicted_aqi, ci_low, ci_high,
                    recommended_grap_stage, statutory_basis, jurisdiction, mandated_actions,
                    exposed_population, dominant_source, escalation, model_version, evidence_sources, source
                ) VALUES (
                    :alertId, :issuedAt, :horizonHours, :predictedAqi, :ciLow, :ciHigh,
                    :stage, :basis, string_to_array(:jurisdiction, ','), string_to_array(:actions, ','), :population,
                    CAST(:dominantSource AS jsonb), CAST(:escalation AS jsonb), :modelVersion,
                    string_to_array(:evidenceSources, ','), :source
                ) ON CONFLICT (alert_id) DO NOTHING
                RETURNING id
                """,
                parameters,
                (rs, row) -> rs.getLong("id"));
        if (!inserted.isEmpty()) {
            jdbc.update(
                    """
                    INSERT INTO alert_outbox (alert_id, channel, payload)
                    VALUES (:id, 'CONSOLE', CAST(:payload AS jsonb))
                    """,
                    new MapSqlParameterSource()
                            .addValue("id", inserted.getFirst())
                            .addValue("payload", json(Map.of("alertId", alertId))));
        }
    }

    private Optional<DominantCluster> dominantCluster() {
        return jdbc.query(
                        """
                        SELECT cluster.code, impact.downwind_population, impact.trajectory_confidence,
                               impact.consecutive_days_unactioned, impact.source
                        FROM fire_cluster_impact impact
                        JOIN fire_cluster cluster ON cluster.id = impact.fire_cluster_id
                        WHERE impact.receptor = 'DELHI-NCR'
                        ORDER BY impact.impact_rank ASC, cluster.detection_date DESC
                        LIMIT 1
                        """,
                        (rs, row) -> {
                            long population = rs.getLong("downwind_population");
                            Long downwindPopulation = rs.wasNull() ? null : population;
                            double confidence = rs.getDouble("trajectory_confidence");
                            Double trajectoryConfidence = rs.wasNull() ? null : confidence;
                            return new DominantCluster(
                                    rs.getString("code"),
                                    downwindPopulation,
                                    trajectoryConfidence,
                                    rs.getInt("consecutive_days_unactioned"),
                                    rs.getString("source"));
                        })
                .stream()
                .findFirst();
    }

    private String dominantSourceJson(DominantCluster cluster) {
        // Map.of throws on null values, and a null confidence must not become 0.0.
        // The key is omitted when unknown, so a consumer sees an absent field
        // rather than a confident zero.
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("type", "crop_residue_transport");
        payload.put("clusters", List.of(cluster.code()));
        if (cluster.trajectoryConfidence() != null) {
            payload.put("trajectory_confidence", cluster.trajectoryConfidence());
        }
        return json(payload);
    }

    private String escalationJson(DominantCluster cluster) {
        int days = cluster == null ? 0 : cluster.consecutiveDaysUnactioned();
        return json(Map.of("direction_95_eligible", days >= 3, "consecutive_days_unactioned", days));
    }

    private String json(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("could not serialize alert evidence", exception);
        }
    }

    private record ForecastCandidate(
            long id, OffsetDateTime issuedAt, int horizonHours, int aqi, double ciLow, double ciHigh,
            String modelVersion, String source) {}

    /**
     * Boxed types on purpose. downwind_population and trajectory_confidence are
     * nullable, and ResultSet.getLong/getDouble return 0 and 0.0 for SQL NULL.
     * That turned "we do not know" into "we are confident it is zero", which is
     * the failure this project least wants to make in an alert an officer acts on.
     */
    private record DominantCluster(
            String code, Long downwindPopulation, Double trajectoryConfidence,
            int consecutiveDaysUnactioned, String source) {}
}
