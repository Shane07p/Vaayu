package org.vaayu.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.OffsetDateTime;
import java.util.NoSuchElementException;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.vaayu.genai.GroundedNarrator;
import org.vaayu.genai.Narrative;
import org.vaayu.genai.NarrativeLanguage;
import org.vaayu.web.dto.NearestStationResponse;
import org.vaayu.web.service.CitizenReportService;
import org.vaayu.web.service.ReadQueryOperations;

/**
 * A citizen advisory written only in English does not serve the people most
 * exposed, which is why the language is a parameter rather than a translation
 * step applied afterwards.
 */
class CitizenAdvisoryControllerTest {

    private final ReadQueryOperations queries = mock(ReadQueryOperations.class);
    private final CitizenReportService reports = mock(CitizenReportService.class);
    private final GroundedNarrator narrator = mock(GroundedNarrator.class);
    private final PublicController controller = new PublicController(queries, reports, narrator);

    private NearestStationResponse station(boolean stale) {
        return new NearestStationResponse(
                1L,
                "OPENAQ-1",
                "Anand Vihar, New Delhi - DPCC",
                "New Delhi",
                77.31,
                28.65,
                2.6,
                80.0,
                167,
                OffsetDateTime.parse("2026-08-23T10:00:00Z"),
                stale,
                "LIVE");
    }

    @Test
    @DisplayName("an advisory names the station and its distance in the facts")
    void advisoryCarriesStationFacts() {
        when(queries.nearest(anyDouble(), anyDouble())).thenReturn(Optional.of(station(false)));
        when(narrator.narrate(any(), any(), any()))
                .thenReturn(Narrative.of("AQI 167 nearby.", NarrativeLanguage.ENGLISH));

        var response = controller.advisory("en", 28.6, 77.2);

        assertThat(response.narrative()).isEqualTo("AQI 167 nearby.");
        assertThat(response.facts()).containsEntry("AQI", "167");
        assertThat(response.facts()).containsEntry("Distance in kilometres", "2.6");
        assertThat(response.facts()).containsEntry("Station", "Anand Vihar, New Delhi - DPCC");
    }

    @Test
    @DisplayName("with no station nearby there is nothing to advise on")
    void noStationIsNotFound() {
        when(queries.nearest(anyDouble(), anyDouble())).thenReturn(Optional.empty());

        assertThat(catchThrowable(() -> controller.advisory("en", 0.0, 0.0)))
                .isInstanceOf(NoSuchElementException.class);
    }

    @Test
    @DisplayName("an unsupported language is rejected rather than answered in English")
    void unsupportedLanguageIsRejected() {
        assertThat(catchThrowable(() -> controller.advisory("fr", 28.6, 77.2)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("a stale reading is stated as a fact, not hidden")
    void staleReadingIsStated() {
        when(queries.nearest(anyDouble(), anyDouble())).thenReturn(Optional.of(station(true)));
        when(narrator.narrate(any(), any(), any()))
                .thenReturn(Narrative.of("AQI 167.", NarrativeLanguage.ENGLISH));

        var response = controller.advisory("en", 28.6, 77.2);

        assertThat(response.facts()).containsEntry("Reading is recent", "no");
    }

    @Test
    @DisplayName("a withheld advisory still returns the facts")
    void withheldAdvisoryStillReturnsFacts() {
        when(queries.nearest(anyDouble(), anyDouble())).thenReturn(Optional.of(station(false)));
        when(narrator.narrate(any(), any(), any()))
                .thenReturn(Narrative.ungrounded(NarrativeLanguage.HINDI, java.util.Set.of("42")));

        var response = controller.advisory("hi", 28.6, 77.2);

        assertThat(response.narrative()).isNull();
        assertThat(response.status()).isEqualTo("UNGROUNDED");
        assertThat(response.facts()).containsEntry("AQI", "167");
    }
}
