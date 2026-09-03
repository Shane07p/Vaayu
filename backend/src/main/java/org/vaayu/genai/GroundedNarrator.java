package org.vaayu.genai;

import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.vaayu.web.service.GeminiTextGenerator;

/**
 * Turns a fact block into prose, in a chosen language, and refuses to return
 * prose that states a number it was not given.
 *
 * <p>One narrator serves both surfaces. The alert briefing and the citizen
 * advisory differ only in which facts are supplied and how the reader is
 * framed, so this is one service with two thin callers rather than two
 * pipelines.
 */
@Service
public class GroundedNarrator {

    private static final Logger log = LoggerFactory.getLogger(GroundedNarrator.class);

    /**
     * The rule that makes the output checkable.
     *
     * <p>Digits, because "four hundred and twenty-eight" cannot be validated and
     * 428 can. Western numerals, because rendering AQI 428 in Devanagari or
     * Gurmukhi digits would defeat the check and stop an officer
     * cross-referencing the figure against the console; Indian official usage
     * keeps Western numerals for figures.
     */
    private static final String NUMERAL_RULE =
            """
            Write every figure using Western digits 0123456789. \
            Never write a number as words, and never use any other numeral system. \
            Use only the numbers given in the facts below. Do not calculate, \
            estimate, round, or introduce any other number.""";

    private final GeminiTextGenerator generator;

    public GroundedNarrator(GeminiTextGenerator generator) {
        this.generator = generator;
    }

    /**
     * @param role how the reader is framed, supplied by the caller
     * @param facts everything the narrative may state
     * @param language the language to answer in
     */
    @Cacheable(
            value = "narratives",
            key = "#role.hashCode() + ':' + #facts.contentHash() + ':' + #language.code()",
            // Only a narrative that exists is worth keeping.
            //
            // The cache holds entries for six hours, which is right for prose
            // generated from facts that no longer change. It is wrong for a
            // failure. The free tier allows twenty generate_content requests a
            // day, and the twenty-first returns 429, which this method correctly
            // reports as SOURCE_UNAVAILABLE -- and which was then cached. So a
            // single burst of demo traffic pinned "the model could not be
            // reached" onto that alert for the next six hours, long after the
            // quota had reset and the model was answering again, with no way to
            // clear it short of restarting the service.
            //
            // UNGROUNDED is excluded for a different reason: generation is not
            // deterministic, so the next attempt may well come back grounded.
            // Caching the refusal would deny the reader a summary the system is
            // perfectly able to produce.
            unless = "#result == null || #result.status() != T(org.vaayu.genai.Narrative.Status).OK")
    public Narrative narrate(String role, NarrativeFacts facts, NarrativeLanguage language) {
        String systemPrompt = buildSystemPrompt(role, facts, language);

        String reply;
        try {
            reply = generator.generateText(systemPrompt, "Write the briefing now.");
        } catch (RuntimeException exc) {
            // The upstream is down. Distinct from our own check failing.
            log.warn("Gemini unavailable for a {} narrative: {}", language.code(), exc.toString());
            return Narrative.sourceUnavailable(language);
        }

        if (reply == null || reply.isBlank()) {
            return Narrative.sourceUnavailable(language);
        }

        Set<String> unsourced = GroundingValidator.unsourcedNumbers(reply, facts);
        if (!unsourced.isEmpty()) {
            // Withheld rather than returned with a warning. It reads plausibly,
            // which is exactly why it cannot be shown.
            log.warn("Withholding a {} narrative that introduced {}", language.code(), unsourced);
            return Narrative.ungrounded(language, unsourced);
        }

        return Narrative.of(reply.trim(), language);
    }

    private String buildSystemPrompt(String role, NarrativeFacts facts, NarrativeLanguage language) {
        return """
               %s

               Answer only in %s. Do not answer in any other language.

               %s

               Be brief: at most four sentences. State what is expected, where, \
               and what must be done. Do not speculate beyond the facts.

               FACTS
               %s
               """
                .formatted(role, language.geminiName(), NUMERAL_RULE, facts.asPromptBlock());
    }
}
