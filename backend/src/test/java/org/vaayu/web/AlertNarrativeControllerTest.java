package org.vaayu.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.vaayu.genai.GroundedNarrator;
import org.vaayu.genai.Narrative;
import org.vaayu.genai.NarrativeLanguage;
import org.vaayu.web.dto.AlertResponse;
import org.vaayu.web.service.ReadQueryOperations;

/**
 * The briefing endpoint returns the facts whether or not the prose survives.
 * The reader loses the narrative, not the information.
 */
class AlertNarrativeControllerTest {

    private final ReadQueryOperations queries = mock(ReadQueryOperations.class);
    private final GroundedNarrator narrator = mock(GroundedNarrator.class);
    private final ConsoleController controller = new ConsoleController(queries, narrator);

    private AlertResponse alert() {
        return new AlertResponse(
                "ALERT-1",
                OffsetDateTime.parse("2026-08-23T10:00:00Z"),
                48,
                428,
                146,
                496,
                "IV",
                "GRAP Stage IV, CAQM Direction 95",
                List.of("Rohini"),
                List.of("Stop construction"),
                1_200_000L,
                "seed-v0",
                List.of("CPCB"),
                "SEED");
    }

    @Test
    @DisplayName("a grounded briefing is returned with its facts")
    void returnsBriefingAndFacts() {
        when(queries.alert("ALERT-1")).thenReturn(Optional.of(alert()));
        when(narrator.narrate(any(), any(), any()))
                .thenReturn(Narrative.of("AQI 428 expected.", NarrativeLanguage.ENGLISH));

        var response = controller.narrative("ALERT-1", "en");

        assertThat(response.narrative()).isEqualTo("AQI 428 expected.");
        assertThat(response.status()).isEqualTo("OK");
        assertThat(response.language()).isEqualTo("en");
        assertThat(response.facts()).containsEntry("Predicted AQI", "428");
    }

    @Test
    @DisplayName("a withheld briefing still returns the facts")
    void withheldBriefingStillReturnsFacts() {
        when(queries.alert("ALERT-1")).thenReturn(Optional.of(alert()));
        when(narrator.narrate(any(), any(), any()))
                .thenReturn(Narrative.ungrounded(NarrativeLanguage.ENGLISH, Set.of("999")));

        var response = controller.narrative("ALERT-1", "en");

        assertThat(response.narrative()).isNull();
        assertThat(response.status()).isEqualTo("UNGROUNDED");
        assertThat(response.unsourcedNumbers()).containsExactly("999");
        assertThat(response.facts()).isNotEmpty();
    }

    @Test
    @DisplayName("an outage also returns the facts, under its own status")
    void outageStillReturnsFacts() {
        when(queries.alert("ALERT-1")).thenReturn(Optional.of(alert()));
        when(narrator.narrate(any(), any(), any()))
                .thenReturn(Narrative.sourceUnavailable(NarrativeLanguage.ENGLISH));

        var response = controller.narrative("ALERT-1", "en");

        assertThat(response.status()).isEqualTo("SOURCE_UNAVAILABLE");
        assertThat(response.facts()).containsEntry("GRAP stage", "IV");
    }

    @Test
    @DisplayName("the statutory basis and jurisdiction reach the facts")
    void statutoryFactsArePresent() {
        when(queries.alert("ALERT-1")).thenReturn(Optional.of(alert()));
        when(narrator.narrate(any(), any(), any()))
                .thenReturn(Narrative.of("Issued.", NarrativeLanguage.ENGLISH));

        var response = controller.narrative("ALERT-1", "en");

        assertThat(response.facts())
                .containsEntry("Statutory basis", "GRAP Stage IV, CAQM Direction 95")
                .containsEntry("Jurisdiction", "Rohini")
                .containsEntry("Mandated actions", "Stop construction");
    }

    @Test
    @DisplayName("an unsupported language is rejected, not answered in English")
    void unsupportedLanguageIsRejected() {
        assertThat(catchThrowable(() -> controller.narrative("ALERT-1", "fr")))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("an unknown alert is not found")
    void unknownAlertIsNotFound() {
        when(queries.alert("NOPE")).thenReturn(Optional.empty());

        assertThat(catchThrowable(() -> controller.narrative("NOPE", "en")))
                .isInstanceOf(NoSuchElementException.class);
    }
}
