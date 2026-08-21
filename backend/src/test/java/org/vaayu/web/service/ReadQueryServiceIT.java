package org.vaayu.web.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Verifies the SQL projection layer against the same PostGIS image used in compose. */
@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
class ReadQueryServiceIT {
    @Container
    static final PostgreSQLContainer<?> POSTGIS = new PostgreSQLContainer<>("postgis/postgis:16-3.4")
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

    @Test
    void returns_seeded_station_grid_and_forecast_projections() {
        var stations = queries.stations();

        assertThat(stations).hasSize(5);
        assertThat(queries.grid(76.9, 28.4, 77.1, 28.6)).hasSize(400);
        assertThat(queries.forecast(stations.getFirst().id()))
                .extracting(forecast -> forecast.horizonHours())
                .containsExactly(6, 24, 72);
    }

    @Test
    void returns_authority_projections_from_seed_data() {
        assertThat(queries.worklist("DELHI-NCR")).hasSize(2);
        assertThat(queries.alerts()).extracting(alert -> alert.alertId())
                .contains("SEED-VAAYU-0001");
    }
}
