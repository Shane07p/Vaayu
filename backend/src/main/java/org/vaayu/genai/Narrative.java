package org.vaayu.genai;

import java.util.Set;

/**
 * A generated narrative, or the reason there isn't one.
 *
 * <p>In both failure cases the caller still returns the structured facts. The
 * reader loses the prose, not the information.
 */
public record Narrative(
        String text, NarrativeLanguage language, Status status, Set<String> unsourcedNumbers) {

    public enum Status {
        OK,
        /** Gemini could not be reached. The upstream is down. */
        SOURCE_UNAVAILABLE,
        /** Generation succeeded and introduced a number the facts never contained. */
        UNGROUNDED
    }

    public static Narrative of(String text, NarrativeLanguage language) {
        return new Narrative(text, language, Status.OK, Set.of());
    }

    public static Narrative sourceUnavailable(NarrativeLanguage language) {
        return new Narrative(null, language, Status.SOURCE_UNAVAILABLE, Set.of());
    }

    /** The prose is withheld. It read plausibly, which is exactly the problem. */
    public static Narrative ungrounded(NarrativeLanguage language, Set<String> unsourced) {
        return new Narrative(null, language, Status.UNGROUNDED, Set.copyOf(unsourced));
    }
}
