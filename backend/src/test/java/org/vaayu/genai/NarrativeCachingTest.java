package org.vaayu.genai;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayDeque;
import java.util.Deque;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.vaayu.config.CacheConfig;
import org.vaayu.web.service.GeminiTextGenerator;

/**
 * What the narrative cache is allowed to remember.
 *
 * <p>Entries live for six hours, which suits prose written from facts that do
 * not change. It does not suit a failure. The free tier allows twenty
 * generate_content requests a day; the twenty-first returns 429, the narrator
 * reports SOURCE_UNAVAILABLE, and caching that answer pinned "the model could
 * not be reached" onto an alert for six hours after the quota had reset.
 *
 * <p>Annotations are proxy behaviour, so this runs in a container. A plain unit
 * test constructs the bean directly and never goes through the interceptor,
 * which is why it kept passing while the cache was storing outages.
 */
@SpringJUnitConfig(NarrativeCachingTest.Config.class)
class NarrativeCachingTest {

    private static final String ROLE = "You are briefing a district magistrate.";

    /** Returns each scripted outcome once, so a repeat call is visible. */
    static final class ScriptedGenerator implements GeminiTextGenerator {
        private final Deque<Object> script = new ArrayDeque<>();
        int calls;

        void willReturn(String reply) {
            script.add(reply);
        }

        void willFail(RuntimeException failure) {
            script.add(failure);
        }

        void reset() {
            script.clear();
            calls = 0;
        }

        @Override
        public String generateText(String systemPrompt, String userPrompt) {
            calls++;
            Object next = script.poll();
            if (next instanceof RuntimeException failure) {
                throw failure;
            }
            return (String) next;
        }
    }

    @Configuration
    @EnableCaching
    @Import({CacheConfig.class, GroundedNarrator.class})
    static class Config {
        @Bean
        ScriptedGenerator generator() {
            return new ScriptedGenerator();
        }
    }

    @Autowired
    private GroundedNarrator narrator;

    @Autowired
    private ScriptedGenerator generator;

    @Autowired
    private CacheManager cacheManager;

    /**
     * The container is built once for the class, so the generator's call count
     * and the cache both carry over between tests. Both are reset, because the
     * assertions here are about exactly how many times the model was asked.
     */
    @BeforeEach
    void reset() {
        generator.reset();
        Cache narratives = cacheManager.getCache("narratives");
        if (narratives != null) {
            narratives.clear();
        }
    }

    /** Facts differ per test so each one gets its own cache key. */
    private NarrativeFacts facts(int aqi) {
        return NarrativeFacts.builder()
                .number("Predicted AQI", aqi)
                .fact("Jurisdiction", "Rohini")
                .build();
    }

    @Test
    @DisplayName("a grounded narrative is generated once and served from the cache after")
    void groundedNarrativeIsCached() {
        generator.willReturn("AQI 428 expected in Rohini.");
        NarrativeFacts facts = facts(428);

        Narrative first = narrator.narrate(ROLE, facts, NarrativeLanguage.ENGLISH);
        Narrative second = narrator.narrate(ROLE, facts, NarrativeLanguage.ENGLISH);

        assertThat(first.status()).isEqualTo(Narrative.Status.OK);
        assertThat(second.text()).isEqualTo(first.text());
        assertThat(generator.calls)
                .as("the model should be asked once for facts that have not changed")
                .isEqualTo(1);
    }

    @Test
    @DisplayName("an outage is not cached, so the next reader gets a real attempt")
    void outageIsNotCached() {
        // A 429 on the first ask, a working model on the second.
        generator.willFail(new IllegalStateException("429 Too Many Requests"));
        generator.willReturn("AQI 301 expected in Rohini.");
        NarrativeFacts facts = facts(301);

        Narrative first = narrator.narrate(ROLE, facts, NarrativeLanguage.ENGLISH);
        Narrative second = narrator.narrate(ROLE, facts, NarrativeLanguage.ENGLISH);

        assertThat(first.status()).isEqualTo(Narrative.Status.SOURCE_UNAVAILABLE);
        // The point of the fix: the quota reset between the two calls, and the
        // reader gets the narrative rather than six hours of a stored outage.
        assertThat(second.status()).isEqualTo(Narrative.Status.OK);
        assertThat(second.text()).isEqualTo("AQI 301 expected in Rohini.");
        assertThat(generator.calls).isEqualTo(2);
    }

    @Test
    @DisplayName("a withheld narrative is not cached either, because generation is not deterministic")
    void ungroundedIsNotCached() {
        // 999 appears in neither fact, so the first reply is withheld.
        generator.willReturn("AQI 999 expected in Rohini.");
        generator.willReturn("AQI 214 expected in Rohini.");
        NarrativeFacts facts = facts(214);

        Narrative first = narrator.narrate(ROLE, facts, NarrativeLanguage.ENGLISH);
        Narrative second = narrator.narrate(ROLE, facts, NarrativeLanguage.ENGLISH);

        assertThat(first.status()).isEqualTo(Narrative.Status.UNGROUNDED);
        assertThat(first.unsourcedNumbers()).containsExactly("999");
        // The model may well answer within its facts next time. Caching the
        // refusal would deny a summary the system can produce.
        assertThat(second.status()).isEqualTo(Narrative.Status.OK);
        assertThat(generator.calls).isEqualTo(2);
    }
}
