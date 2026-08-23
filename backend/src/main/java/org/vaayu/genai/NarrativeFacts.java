package org.vaayu.genai;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * The facts a narrative is allowed to state.
 *
 * <p>Holds two things: an ordered block for the prompt, and the set of numbers
 * that block licenses. The second is what makes the output checkable.
 *
 * <p>Some numbers are legitimately derived rather than literal -- a horizon of
 * 48 hours may reasonably be written as "2 days". Rather than attempt to infer
 * arithmetic after the fact, those forms are declared here so they are allowed
 * before generation begins. If a narrative needs a number, that number is given
 * to the model.
 */
public final class NarrativeFacts {

    private final Map<String, String> facts;
    private final Set<String> allowedNumbers;
    private final List<String> order;

    private NarrativeFacts(Map<String, String> facts, Set<String> allowedNumbers) {
        this.facts = Map.copyOf(facts);
        this.allowedNumbers = Set.copyOf(allowedNumbers);
        // Map.copyOf does not preserve insertion order, and the prompt reads
        // better when the facts arrive in the order the caller stated them.
        this.order = List.copyOf(facts.keySet());
    }

    public static Builder builder() {
        return new Builder();
    }

    /** The facts as the prompt sees them, one per line. */
    public String asPromptBlock() {
        StringBuilder block = new StringBuilder();
        for (String label : order) {
            block.append(label).append(": ").append(facts.get(label)).append('\n');
        }
        return block.toString();
    }

    /** Every number the narrative may use, as written. */
    public Set<String> allowedNumbers() {
        return allowedNumbers;
    }

    /** The facts, for returning alongside the narrative. */
    public Map<String, String> asMap() {
        return facts;
    }

    /**
     * Stable across identical facts, so a cache entry survives repeat views and
     * a change to the facts produces a different key and a regeneration.
     */
    public String contentHash() {
        return Integer.toHexString(asPromptBlock().hashCode());
    }

    public static final class Builder {
        private final Map<String, String> facts = new LinkedHashMap<>();
        private final Set<String> numbers = new LinkedHashSet<>();

        /** A fact with no numeric content, such as a GRAP stage or a place. */
        public Builder fact(String label, String value) {
            if (value != null && !value.isBlank()) {
                facts.put(label, value);
                allow(label);
                // A textual fact may still contain digits -- "Direction 95",
                // "GRAP Stage IV" -- and the narrative must be able to repeat it.
                allow(value);
            }
            return this;
        }

        /** A numeric fact. Both stated in the prompt and permitted in the output. */
        public Builder number(String label, Number value) {
            if (value != null) {
                String written = format(value);
                facts.put(label, written);
                numbers.add(written);
                allow(label);
            }
            return this;
        }

        /**
         * Permit every numeral in a piece of the facts block.
         *
         * <p>Labels count, not only values. "PM2.5" is a label, and a narrative
         * that mentions PM2.5 at all would otherwise be rejected for stating an
         * unsourced 2.5. Anything the model was shown, it may repeat; the check
         * exists to catch numbers it was never given.
         */
        private void allow(String text) {
            numbers.addAll(GroundingValidator.numeralsIn(text));
        }

        /**
         * A number the narrative may use that is not itself stated, such as 2
         * where the horizon is 48 hours.
         */
        public Builder derived(Number value) {
            if (value != null) {
                numbers.add(format(value));
            }
            return this;
        }

        public NarrativeFacts build() {
            return new NarrativeFacts(facts, numbers);
        }

        /** Whole values lose the trailing .0, so the prompt and the check agree. */
        private static String format(Number value) {
            double asDouble = value.doubleValue();
            if (asDouble == Math.floor(asDouble) && !Double.isInfinite(asDouble)) {
                return String.valueOf((long) asDouble);
            }
            return String.valueOf(asDouble);
        }
    }
}
