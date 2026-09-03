package org.vaayu.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.NoSuchElementException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.vaayu.genai.NarrativeLanguage;

/**
 * An unsupported language is the caller's mistake and says so. Answering it in
 * English would be a silent fallback, which this design rules out.
 */
class NarrativeErrorMappingTest {

    private final ApiExceptionHandler handler = new ApiExceptionHandler();

    @Test
    @DisplayName("an unsupported language is a 400 that lists what is supported")
    void unsupportedLanguageIsBadRequest() {
        // The message the endpoint will actually produce, rather than a stand-in.
        Exception raised = org.assertj.core.api.Assertions.catchException(
                () -> NarrativeLanguage.fromCode("fr"));

        var response = handler.badRequest(raised);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().message())
                .contains("fr")
                .contains("en")
                .contains("pa");
    }

    @Test
    @DisplayName("a missing alert is a 404, not a bad request")
    void missingAlertIsNotFound() {
        var response = handler.notFound(new NoSuchElementException("alert was not found"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody().code()).isEqualTo("NOT_FOUND");
    }

    @Test
    @DisplayName("a point with no station nearby is a 404, not an empty advisory")
    void noStationIsNotFound() {
        var response =
                handler.notFound(new NoSuchElementException("no station reports near this point"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody().message()).contains("no station");
    }
}
