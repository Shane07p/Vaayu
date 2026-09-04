package org.vaayu.web.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Verifies the SQL projection layer against the same PostGIS image used in compose. */
@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
class ReadQueryServiceIT {
    @Container
    static final PostgreSQLContainer<?> POSTGIS = new PostgreSQLContainer<>(
            DockerImageName.parse("postgis/postgis:16-3.4").asCompatibleSubstituteFor("postgres"))
            .withDatabaseName("vaayu")
            .withUsername("vaayu")
            .withPassword("vaayu");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGIS::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGIS::getUsername);
        registry.add("spring.datasource.password", POSTGIS::getPassword);
    }

    @Autowired
    private ReadQueryService queries;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void live_queries_exclude_seed_stations_grid_and_forecast() {
        // V908 hides all SEED rows from live queries (demo_only = true).
        // A clean database has only seed data, so all three live endpoints
        // should return empty rather than surfacing invented readings.
        // This is the correct behaviour per PLAN §4.5: a console showing
        // 169 µg/m³ average while real stations read 27 is worse than
        // showing nothing.
        assertThat(queries.stations())
                .as("SEED stations must not appear in the public /stations list")
                .isEmpty();
        assertThat(queries.grid(76.9, 28.4, 77.1, 28.6))
                .as("SEED grid predictions must not appear in the live map")
                .isEmpty();
    }

    @Test
    void returns_authority_projections_from_seed_data() {
        // The worklist shows seed fire clusters (fire detection is real data;
        // only predictions are hidden). Seed alerts are excluded from live
        // queries but still accessible via exampleAlert() for the demo route.
        assertThat(queries.worklist("DELHI-NCR")).hasSize(2);

        assertThat(queries.alerts())
                .as("SEED alert must not appear in the live alert list (demo_only = true)")
                .extracting(alert -> alert.alertId())
                .doesNotContain("SEED-VAAYU-0001");

        assertThat(queries.exampleAlert())
                .as("exampleAlert() must still return the seed alert for the /example route")
                .isPresent()
                .get()
                .extracting(alert -> alert.alertId())
                .isEqualTo("SEED-VAAYU-0001");
    }

    @Test
    void excludes_an_active_sensor_holdout_and_reports_its_reason() {
        var before = queries.stationReadings().getFirst();
        jdbc.update(
                """
                INSERT INTO station_reading_anomaly (reading_id, reason, details)
                SELECT r.id, 'IMPOSSIBLE_CONCENTRATION', '{}'::jsonb
                FROM station_reading r
                WHERE r.station_id = ?
                ORDER BY r.ts DESC
                LIMIT 1
                """,
                before.stationId());

        var after = queries.stationReadings().stream()
                .filter(reading -> reading.stationId() == before.stationId())
                .findFirst()
                .orElseThrow();

        assertThat(after.measuredAt()).isBefore(before.measuredAt());
        assertThat(queries.dataQuality().heldOutReadings()).isEqualTo(1);
        assertThat(queries.dataQuality().reasons())
                .extracting(reason -> reason.reason())
                .containsExactly("IMPOSSIBLE_CONCENTRATION");
    }
}
