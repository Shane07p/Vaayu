package org.vaayu.grap;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class GrapServiceTest {
    private final GrapService service = new GrapService(new GrapProperties(
            "2025-11-21", "CAQM GRAP Schedule (rev. %s), Stage %s",
            List.of(
                    new GrapProperties.Stage("I", "Poor", 201, 300, List.of("dust_suppression")),
                    new GrapProperties.Stage("II", "Very Poor", 301, 400, List.of()),
                    new GrapProperties.Stage("III", "Severe", 401, 450, List.of()),
                    new GrapProperties.Stage("IV", "Severe+", 451, 9999, List.of()))));

    @Test
    void resolves_exact_statutory_boundaries() {
        assertThat(service.stageFor(200)).isEmpty();
        assertThat(service.stageFor(201).orElseThrow().stage()).isEqualTo("I");
        assertThat(service.stageFor(300).orElseThrow().stage()).isEqualTo("I");
        assertThat(service.stageFor(301).orElseThrow().stage()).isEqualTo("II");
        assertThat(service.stageFor(400).orElseThrow().stage()).isEqualTo("II");
        assertThat(service.stageFor(401).orElseThrow().stage()).isEqualTo("III");
        assertThat(service.stageFor(450).orElseThrow().stage()).isEqualTo("III");
        assertThat(service.stageFor(451).orElseThrow().stage()).isEqualTo("IV");
    }

    @Test
    void generates_auditable_statutory_reference() {
        GrapProperties.Stage stage = service.stageFor(428).orElseThrow();
        assertThat(service.statutoryBasis(stage)).isEqualTo(
                "CAQM GRAP Schedule (rev. 2025-11-21), Stage III");
    }
}
