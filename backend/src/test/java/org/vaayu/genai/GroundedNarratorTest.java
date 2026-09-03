package org.vaayu.genai;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.vaayu.web.service.GeminiTextGenerator;

class GroundedNarratorTest {

    private static final String ROLE = "You are briefing a district magistrate.";

    /** Records the prompts it was given and returns a scripted reply. */
    private static final class StubGenerator implements GeminiTextGenerator {
        private final String reply;
        private final RuntimeException failure;
        private final List<String> systemPrompts = new ArrayList<>();
        private int calls;

        StubGenerator(String reply) {
            this(reply, null);
        }

        StubGenerator(String reply, RuntimeException failure) {
            this.reply = reply;
            this.failure = failure;
        }

        @Override
        public String generateText(String systemPrompt, String userPrompt) {
            calls++;
            systemPrompts.add(systemPrompt);
            if (failure != null) {
                throw failure;
            }
            return reply;
        }
    }

    private NarrativeFacts facts() {
        return NarrativeFacts.builder()
                .number("Predicted AQI", 428)
                .number("Horizon hours", 48)
                .fact("GRAP stage", "IV")
                .build();
    }

    @Test
    @DisplayName("a grounded reply is returned as the narrative")
    void returnsGroundedNarrative() {
        StubGenerator generator = new StubGenerator("AQI 428 is expected within 48 hours.");
        GroundedNarrator narrator = new GroundedNarrator(generator);

        Narrative narrative = narrator.narrate(ROLE, facts(), NarrativeLanguage.ENGLISH);

        assertThat(narrative.status()).isEqualTo(Narrative.Status.OK);
        assertThat(narrative.text()).contains("428");
    }

    @Test
    @DisplayName("a reply containing an unsourced number is withheld as UNGROUNDED")
    void withholdsUngroundedNarrative() {
        StubGenerator generator =
                new StubGenerator("AQI 428 expected; 12000 residents must stay indoors.");
        GroundedNarrator narrator = new GroundedNarrator(generator);

        Narrative narrative = narrator.narrate(ROLE, facts(), NarrativeLanguage.ENGLISH);

        assertThat(narrative.status()).isEqualTo(Narrative.Status.UNGROUNDED);
        assertThat(narrative.text()).isNull();
        assertThat(narrative.unsourcedNumbers()).containsExactly("12000");
    }

    @Test
    @DisplayName("an unreachable model is SOURCE_UNAVAILABLE, not UNGROUNDED")
    void outageIsNotUngrounded() {
        StubGenerator generator =
                new StubGenerator(null, new IllegalStateException("connection refused"));
        GroundedNarrator narrator = new GroundedNarrator(generator);

        Narrative narrative = narrator.narrate(ROLE, facts(), NarrativeLanguage.ENGLISH);

        assertThat(narrative.status()).isEqualTo(Narrative.Status.SOURCE_UNAVAILABLE);
        assertThat(narrative.text()).isNull();
    }

    @Test
    @DisplayName("the requested language reaches the prompt")
    void languageReachesThePrompt() {
        StubGenerator generator = new StubGenerator("PM2.5 428.");
        GroundedNarrator narrator = new GroundedNarrator(generator);

        narrator.narrate(ROLE, facts(), NarrativeLanguage.PUNJABI);

        assertThat(generator.systemPrompts.getFirst()).contains("Punjabi");
    }

    @Test
    @DisplayName("the prompt requires digits and Western numerals")
    void promptPinsNumeralForm() {
        StubGenerator generator = new StubGenerator("AQI 428.");
        GroundedNarrator narrator = new GroundedNarrator(generator);

        narrator.narrate(ROLE, facts(), NarrativeLanguage.HINDI);

        String prompt = generator.systemPrompts.getFirst();
        assertThat(prompt).containsIgnoringCase("digits");
        assertThat(prompt).contains("0123456789");
    }

    @Test
    @DisplayName("the facts reach the prompt")
    void factsReachThePrompt() {
        StubGenerator generator = new StubGenerator("AQI 428.");
        GroundedNarrator narrator = new GroundedNarrator(generator);

        narrator.narrate(ROLE, facts(), NarrativeLanguage.ENGLISH);

        assertThat(generator.systemPrompts.getFirst()).contains("Predicted AQI: 428");
        assertThat(generator.systemPrompts.getFirst()).contains("GRAP stage: IV");
    }

    @Test
    @DisplayName("the role framing reaches the prompt, so two callers differ")
    void roleReachesThePrompt() {
        StubGenerator generator = new StubGenerator("AQI 428.");
        GroundedNarrator narrator = new GroundedNarrator(generator);

        narrator.narrate("You are advising a resident.", facts(), NarrativeLanguage.ENGLISH);

        assertThat(generator.systemPrompts.getFirst()).contains("You are advising a resident.");
    }

    @Test
    @DisplayName("a blank reply is an outage, not an empty narrative")
    void blankReplyIsAnOutage() {
        StubGenerator generator = new StubGenerator("   ");
        GroundedNarrator narrator = new GroundedNarrator(generator);

        Narrative narrative = narrator.narrate(ROLE, facts(), NarrativeLanguage.ENGLISH);

        assertThat(narrative.status()).isEqualTo(Narrative.Status.SOURCE_UNAVAILABLE);
    }

    @Test
    @DisplayName("one call per narration, so the model is not asked twice for one answer")
    void callsTheModelOnce() {
        StubGenerator generator = new StubGenerator("AQI 428.");
        GroundedNarrator narrator = new GroundedNarrator(generator);

        narrator.narrate(ROLE, facts(), NarrativeLanguage.ENGLISH);

        assertThat(generator.calls).isEqualTo(1);
    }
}
