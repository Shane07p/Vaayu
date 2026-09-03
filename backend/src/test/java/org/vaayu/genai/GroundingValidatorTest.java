package org.vaayu.genai;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Generated text is untrusted output that must be checked, not a feature
 * assumed to work.
 *
 * <p>Every other part of VAAYU makes fabrication unreachable rather than
 * discouraged: a satellite gap cannot carry a value, a citizen report has no
 * concentration column, an interval that does not contain its estimate is
 * rejected by the database. A fluent language model dropped into that is the
 * single largest credibility risk in the project, and it would fail in the most
 * convincing prose in the application.
 */
class GroundingValidatorTest {

    private NarrativeFacts facts() {
        return NarrativeFacts.builder()
                .number("Predicted AQI", 428)
                .number("Interval low", 146)
                .number("Interval high", 496)
                .number("Horizon hours", 48)
                .fact("GRAP stage", "IV")
                .fact("Jurisdiction", "Rohini")
                .build();
    }

    @Test
    @DisplayName("text whose numerals all appear in the facts is grounded")
    void acceptsSourcedNumbers() {
        String text = "Predicted AQI 428 within 48 hours, interval 146 to 496.";

        assertThat(GroundingValidator.unsourcedNumbers(text, facts())).isEmpty();
        assertThat(GroundingValidator.isGrounded(text, facts())).isTrue();
    }

    @Test
    @DisplayName("a number the facts never contained is reported")
    void rejectsUnsourcedNumber() {
        String text = "Predicted AQI 428, and 12000 residents should stay indoors.";

        assertThat(GroundingValidator.unsourcedNumbers(text, facts())).containsExactly("12000");
        assertThat(GroundingValidator.isGrounded(text, facts())).isFalse();
    }

    @Test
    @DisplayName("matching is on whole tokens, so 428 does not license 1428")
    void matchesWholeTokensOnly() {
        String text = "Predicted AQI 1428.";

        assertThat(GroundingValidator.unsourcedNumbers(text, facts())).containsExactly("1428");
    }

    @Test
    @DisplayName("a number supplied in derived form is accepted")
    void acceptsDerivedForms() {
        NarrativeFacts withDerived = NarrativeFacts.builder()
                .number("Horizon hours", 48)
                .derived(2)
                .build();

        assertThat(GroundingValidator.unsourcedNumbers("Expected within 2 days.", withDerived))
                .isEmpty();
    }

    @Test
    @DisplayName("decimals are compared as written")
    void handlesDecimals() {
        NarrativeFacts withDecimal = NarrativeFacts.builder().number("PM2.5", 91.6).build();

        assertThat(GroundingValidator.unsourcedNumbers("PM2.5 was 91.6 micrograms.", withDecimal))
                .isEmpty();
        assertThat(GroundingValidator.unsourcedNumbers("PM2.5 was 91.7 micrograms.", withDecimal))
                .containsExactly("91.7");
    }

    @Test
    @DisplayName("text with no numbers at all is grounded")
    void acceptsProseWithoutNumbers() {
        assertThat(GroundingValidator.isGrounded("Conditions are deteriorating.", facts())).isTrue();
    }

    @Test
    @DisplayName("a trailing full stop is not read as part of the number")
    void ignoresSentencePunctuation() {
        assertThat(GroundingValidator.unsourcedNumbers("The AQI is 428.", facts())).isEmpty();
    }

    @Test
    @DisplayName("the facts block lists every fact for the prompt")
    void promptBlockContainsEveryFact() {
        String block = facts().asPromptBlock();

        assertThat(block).contains("Predicted AQI: 428");
        assertThat(block).contains("GRAP stage: IV");
        assertThat(block).contains("Jurisdiction: Rohini");
    }

    @Test
    @DisplayName("a numeral in a fact label is sourced, so PM2.5 may be named")
    void labelsAreSourcedToo() {
        // The label is part of the block the model is shown. Without this, any
        // narrative mentioning PM2.5 at all was rejected for stating an
        // unsourced 2.5 -- which is every air quality narrative there is.
        NarrativeFacts labelled = NarrativeFacts.builder().number("PM2.5", 91.6).build();

        assertThat(GroundingValidator.unsourcedNumbers("PM2.5 stands at 91.6.", labelled))
                .isEmpty();
    }

    @Test
    @DisplayName("a statutory reference keeps its number")
    void statutoryReferencesAreSourced() {
        NarrativeFacts statute =
                NarrativeFacts.builder().fact("Statutory basis", "CAQM Direction 95").build();

        assertThat(GroundingValidator.unsourcedNumbers("Issued under Direction 95.", statute))
                .isEmpty();
    }

    @Test
    @DisplayName("an integer-valued number is written without a trailing .0")
    void formatsWholeNumbersWithoutDecimalPoint() {
        NarrativeFacts whole = NarrativeFacts.builder().number("Predicted AQI", 428.0).build();

        assertThat(whole.allowedNumbers()).contains("428");
        assertThat(whole.asPromptBlock()).contains("428").doesNotContain("428.0");
    }
}
