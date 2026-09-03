package org.vaayu.web.dto;

import java.util.Map;
import java.util.Set;

/**
 * A narrative and the facts it was generated from.
 *
 * <p>The facts are always present. When the prose is withheld the client
 * renders the structured view instead, so a reader loses the sentence and keeps
 * the substance.
 *
 * @param status OK, SOURCE_UNAVAILABLE, or UNGROUNDED. Never collapsed: an
 *     upstream outage and a failed fact check warrant different responses, and
 *     saying which one happened is the difference between "we could not reach
 *     the model" and "the model said something we could not verify".
 */
public record NarrativeResponse(
        String narrative,
        String language,
        String status,
        Set<String> unsourcedNumbers,
        Map<String, String> facts) {}
