package org.vaayu.web.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.ResultSet;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.ArgumentMatchers;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcOperations;
import org.vaayu.grap.GrapProperties;
import org.vaayu.grap.GrapService;

class AlertWriterServiceTest {
    private final NamedParameterJdbcOperations jdbc = org.mockito.Mockito.mock(NamedParameterJdbcOperations.class);
    private final GrapService grap = new GrapService(new GrapProperties(
            "2025-11-21", "CAQM GRAP Schedule (rev. %s), Stage %s",
            List.of(
                    new GrapProperties.Stage("I", "Poor", 201, 300, List.of("dust_suppression")),
                    new GrapProperties.Stage("II", "Very Poor", 301, 400, List.of("dust_control")),
                    new GrapProperties.Stage("III", "Severe", 401, 450, List.of("close_brick_kilns")),
                    new GrapProperties.Stage("IV", "Severe+", 451, 9999, List.of("construction_stoppage")))));

    @Test
    void writes_an_idempotent_stage_three_alert_and_outbox_message() throws Exception {
        ResultSet forecast = org.mockito.Mockito.mock(ResultSet.class);
        when(forecast.getLong("id")).thenReturn(12L);
        when(forecast.getObject("issued_at", OffsetDateTime.class)).thenReturn(OffsetDateTime.parse("2026-08-21T06:00:00Z"));
        when(forecast.getInt("horizon_hours")).thenReturn(24);
        when(forecast.getInt("aqi")).thenReturn(428);
        when(forecast.getDouble("ci_low")).thenReturn(391.0);
        when(forecast.getDouble("ci_high")).thenReturn(461.0);
        when(forecast.getString("model_version")).thenReturn("forecast-v1");
        when(forecast.getString("source")).thenReturn("CPCB");

        ResultSet cluster = org.mockito.Mockito.mock(ResultSet.class);
        when(cluster.getString("code")).thenReturn("PB-001");
        when(cluster.getLong("downwind_population")).thenReturn(1_000L);
        when(cluster.getDouble("trajectory_confidence")).thenReturn(0.81);
        when(cluster.getInt("consecutive_days_unactioned")).thenReturn(3);
        when(cluster.getString("source")).thenReturn("FIRMS");

        when(jdbc.query(anyString(), ArgumentMatchers.<RowMapper<Object>>any())).thenAnswer(invocation -> {
            String sql = invocation.getArgument(0);
            RowMapper<?> mapper = invocation.getArgument(1);
            return sql.contains("FROM forecast")
                    ? List.of(mapper.mapRow(forecast, 0))
                    : List.of(mapper.mapRow(cluster, 0));
        });
        when(jdbc.query(contains("INSERT INTO alert"), any(MapSqlParameterSource.class), ArgumentMatchers.<RowMapper<Long>>any()))
                .thenReturn(List.of(99L));

        new AlertWriterService(jdbc, grap, new ObjectMapper()).writeScheduledAlerts();

        ArgumentCaptor<MapSqlParameterSource> params = ArgumentCaptor.forClass(MapSqlParameterSource.class);
        verify(jdbc).query(contains("INSERT INTO alert"), params.capture(), ArgumentMatchers.<RowMapper<Long>>any());
        assert params.getValue().getValue("stage").equals("III");
        assert params.getValue().getValue("alertId").equals("VAAYU-20260821060000-12");
        verify(jdbc).update(contains("INSERT INTO alert_outbox"), any(MapSqlParameterSource.class));
    }

    @Test
    void does_not_write_an_outbox_message_when_the_alert_already_exists() throws Exception {
        ResultSet forecast = org.mockito.Mockito.mock(ResultSet.class);
        when(forecast.getLong("id")).thenReturn(12L);
        when(forecast.getObject("issued_at", OffsetDateTime.class)).thenReturn(OffsetDateTime.parse("2026-08-21T06:00:00Z"));
        when(forecast.getInt("horizon_hours")).thenReturn(24);
        when(forecast.getInt("aqi")).thenReturn(250);
        when(forecast.getDouble("ci_low")).thenReturn(200.0);
        when(forecast.getDouble("ci_high")).thenReturn(300.0);
        when(forecast.getString("model_version")).thenReturn("forecast-v1");
        when(forecast.getString("source")).thenReturn("CPCB");
        when(jdbc.query(anyString(), ArgumentMatchers.<RowMapper<Object>>any())).thenAnswer(invocation -> {
            RowMapper<?> mapper = invocation.getArgument(1);
            return List.of(mapper.mapRow(forecast, 0));
        });
        when(jdbc.query(contains("INSERT INTO alert"), any(MapSqlParameterSource.class), ArgumentMatchers.<RowMapper<Long>>any()))
                .thenReturn(List.of());

        new AlertWriterService(jdbc, grap, new ObjectMapper()).writeScheduledAlerts();

        verify(jdbc, never()).update(contains("INSERT INTO alert_outbox"), any(MapSqlParameterSource.class));
    }
}
