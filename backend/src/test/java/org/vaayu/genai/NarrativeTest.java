package org.vaayu.genai;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * The two failure states are distinct on purpose.
 *
 * <p>This mirrors the distinction already drawn in ingestion_run between
 * SOURCE_UNAVAILABLE and FAILED: an upstream outage and our own component
 * misbehaving warrant different responses, and collapsing them hides which one
 * happened.
 */
class NarrativeTest {

    @Test
    @DisplayName("a successful narrative carries its text and language")
    void carriesTextAndLanguage() {
        Narrative narrative = Narrative.of("AQI 428 expected.", NarrativeLanguage.ENGLISH);

        assertThat(narrative.status()).isEqualTo(Narrative.Status.OK);
        assertThat(narrative.text()).isEqualTo("AQI 428 expected.");
        assertThat(narrative.language()).isEqualTo(NarrativeLanguage.ENGLISH);
        assertThat(narrative.unsourcedNumbers()).isEmpty();
    }

    @Test
    @DisplayName("an upstream outage carries no text")
    void outageCarriesNoText() {
        Narrative narrative = Narrative.sourceUnavailable(NarrativeLanguage.HINDI);

        assertThat(narrative.status()).isEqualTo(Narrative.Status.SOURCE_UNAVAILABLE);
        assertThat(narrative.text()).isNull();
        assertThat(narrative.language()).isEqualTo(NarrativeLanguage.HINDI);
    }

    @Test
    @DisplayName("a failed check names the numbers that failed it, and withholds the prose")
    void ungroundedNamesTheNumbers() {
        Narrative narrative = Narrative.ungrounded(NarrativeLanguage.PUNJABI, Set.of("12000"));

        assertThat(narrative.status()).isEqualTo(Narrative.Status.UNGROUNDED);
        assertThat(narrative.text()).isNull();
        assertThat(narrative.unsourcedNumbers()).containsExactly("12000");
    }
}
