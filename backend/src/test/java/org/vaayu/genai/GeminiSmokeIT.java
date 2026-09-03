package org.vaayu.genai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.vaayu.web.service.GeminiClient;
import org.vaayu.web.service.GeminiProperties;

/**
 * One live call per surface, against the real API.
 *
 * <p>Skipped without a key, which is the standing rule for every source in this
 * project: CI must stay green without credentials. Run it deliberately when
 * changing a prompt, because a prompt regression is invisible to a stubbed test
 * -- the stub returns whatever it was told to, so it will keep passing while
 * the real model starts writing numbers nobody gave it.
 *
 * <p>These tests exist to check the prompt, not the model's availability. The
 * free tier allows twenty generate_content requests per day, and a run that
 * exhausts it returns 429, which the narrator correctly reports as
 * SOURCE_UNAVAILABLE. That is a condition of the environment rather than a
 * defect in the prompt, so it is treated as an inability to test rather than a
 * failure -- the assertion that matters cannot be evaluated either way.
 */
@EnabledIfEnvironmentVariable(named = "GEMINI_API_KEY", matches = ".+")
class GeminiSmokeIT {

    private GroundedNarrator narrator() {
        GeminiProperties properties = new GeminiProperties(
                System.getenv("GEMINI_API_KEY"),
                System.getenv().getOrDefault("GEMINI_MODEL", "gemini-3.6-flash"));
        return new GroundedNarrator(new GeminiClient(properties, new ObjectMapper()));
    }

    private NarrativeFacts facts() {
        return NarrativeFacts.builder()
                .number("Predicted AQI", 428)
                .number("Horizon hours", 48)
                .derived(2)
                .fact("GRAP stage", "IV")
                .fact("Jurisdiction", "Rohini")
                .fact("Statutory basis", "CAQM Direction 95")
                .build();
    }

    @Test
    @DisplayName("a real English briefing is grounded")
    void englishBriefingIsGrounded() {
        Narrative narrative = narrator().narrate(
                "You are briefing a district magistrate in India.",
                facts(),
                NarrativeLanguage.ENGLISH);

        // A 429 or an outage means the prompt could not be exercised at all.
        // Skipping says so; failing would claim the prompt is broken.
        assumeTrue(
                narrative.status() != Narrative.Status.SOURCE_UNAVAILABLE,
                "Gemini unavailable -- likely the twenty request daily free-tier quota");

        assertThat(narrative.status())
                .as("unsourced numbers: %s", narrative.unsourcedNumbers())
                .isEqualTo(Narrative.Status.OK);
        assertThat(narrative.text()).isNotBlank();
    }

    @Test
    @DisplayName("a real Punjabi advisory is grounded and uses Western digits")
    void punjabiAdvisoryUsesWesternDigits() {
        Narrative narrative = narrator().narrate(
                "You are advising a resident of an Indian city.",
                facts(),
                NarrativeLanguage.PUNJABI);

        // A 429 or an outage means the prompt could not be exercised at all.
        // Skipping says so; failing would claim the prompt is broken.
        assumeTrue(
                narrative.status() != Narrative.Status.SOURCE_UNAVAILABLE,
                "Gemini unavailable -- likely the twenty request daily free-tier quota");

        assertThat(narrative.status())
                .as("unsourced numbers: %s", narrative.unsourcedNumbers())
                .isEqualTo(Narrative.Status.OK);
        // Gurmukhi digits would defeat the grounding check and stop an officer
        // cross-referencing the figure against the console.
        assertThat(narrative.text()).doesNotContainPattern("[੦-੯]");
    }

    @Test
    @DisplayName("a real Hindi briefing is grounded and uses Western digits")
    void hindiBriefingUsesWesternDigits() {
        Narrative narrative = narrator().narrate(
                "You are briefing a district magistrate in India.",
                facts(),
                NarrativeLanguage.HINDI);

        // A 429 or an outage means the prompt could not be exercised at all.
        // Skipping says so; failing would claim the prompt is broken.
        assumeTrue(
                narrative.status() != Narrative.Status.SOURCE_UNAVAILABLE,
                "Gemini unavailable -- likely the twenty request daily free-tier quota");

        assertThat(narrative.status())
                .as("unsourced numbers: %s", narrative.unsourcedNumbers())
                .isEqualTo(Narrative.Status.OK);
        // Devanagari digits, for the same reason.
        assertThat(narrative.text()).doesNotContainPattern("[०-९]");
    }
}
