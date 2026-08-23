package org.vaayu.genai;

import java.util.LinkedHashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Checks that a generated narrative states no number it was not given.
 *
 * <p>Validation reduces to set membership because the prompt requires digits:
 *
 * <pre>
 *   allowed   = every number in the supplied facts
 *   found     = every numeral token in the generated text
 *   unsourced = found - allowed        must be empty
 * </pre>
 *
 * <p>Matching is on whole tokens, so {@code 428} inside {@code 1428} does not
 * count as present. A model that writes "AQI 450 expected in Rohini tomorrow"
 * when no such figure exists would undo the project's whole argument, and it
 * would do so in the most convincing prose in the application.
 */
public final class GroundingValidator {

    /**
     * A numeral token: digits, optionally with a decimal part.
     *
     * <p>The lookbehind refuses a match that begins part-way through a longer
     * number, so {@code 428} is not found inside {@code 1428}. The lookahead
     * refuses one that stops short of the end, so {@code 1428} is not read as
     * {@code 142} either. A trailing full stop is excluded because it is
     * sentence punctuation, not a decimal point.
     */
    private static final Pattern NUMERAL =
            Pattern.compile("(?<![\\d.])\\d+(?:\\.\\d+)?(?![\\d]|\\.\\d)");

    private GroundingValidator() {}

    /** Every numeral token in the text, in order of appearance. */
    static Set<String> numeralsIn(String text) {
        Set<String> found = new LinkedHashSet<>();
        if (text == null) {
            return found;
        }
        Matcher matcher = NUMERAL.matcher(text);
        while (matcher.find()) {
            found.add(matcher.group());
        }
        return found;
    }

    /** Numbers the text states that the facts never contained. */
    public static Set<String> unsourcedNumbers(String text, NarrativeFacts facts) {
        Set<String> unsourced = new LinkedHashSet<>(numeralsIn(text));
        unsourced.removeAll(facts.allowedNumbers());
        return unsourced;
    }

    public static boolean isGrounded(String text, NarrativeFacts facts) {
        return unsourcedNumbers(text, facts).isEmpty();
    }
}
