package org.vaayu.web.service;

import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.vaayu.web.dto.AlertResponse;
import org.vaayu.web.dto.ForecastResponse;
import org.vaayu.web.dto.GridPredictionResponse;
import org.vaayu.web.dto.StationResponse;
import org.vaayu.web.dto.WorklistActionResponse;
import org.vaayu.web.dto.WorklistItemResponse;

/** Read-only SQL projection layer; Flyway, rather than Hibernate, owns this schema. */
@Service
@Transactional(readOnly = true)
public class ReadQueryService implements ReadQueryOperations {
    private final NamedParameterJdbcTemplate jdbc;

    public ReadQueryService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
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
                WHERE ST_Within(
                    g.centroid::geometry,
                    ST_MakeEnvelope(:minLon, :minLat, :maxLon, :maxLat, 4326)
                )
                """,
                Map.of("minLon", minLon, "minLat", minLat, "maxLon", maxLon, "maxLat", maxLat),
                (rs, row) -> new GridPredictionResponse(
                        rs.getLong("grid_cell_id"), rs.getString("code"), rs.getDouble("lon"),
                        rs.getDouble("lat"), timestamp(rs, "ts"),
                        rs.getDouble("pm25_q10"), rs.getDouble("pm25_q50"), rs.getDouble("pm25_q90"),
                        rs.getDouble("coverage_fraction"), rs.getString("model_version"),
                        rs.getString("source")));
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
                (rs, row) -> new ForecastResponse(
                        rs.getLong("id"), nullableLong(rs, "station_id"), timestamp(rs, "issued_at"),
                        rs.getInt("horizon_hours"), timestamp(rs, "valid_at"), rs.getDouble("pm25"),
                        rs.getInt("aqi"), rs.getDouble("ci_low"), rs.getDouble("ci_high"),
                        rs.getDouble("baseline_persistence"), nullableDouble(rs, "baseline_cams"),
                        rs.getString("model_version"), rs.getString("source")));
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

    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = "worklist", allEntries = true)
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
        if (actions.isEmpty()) {
            throw new java.util.NoSuchElementException("worklist cluster was not found");
        }
        return actions.getFirst();
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
