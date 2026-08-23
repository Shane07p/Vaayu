package org.vaayu.genai;

import java.util.Arrays;
import java.util.stream.Collectors;

/**
 * Languages a narrative may be generated in.
 *
 * <p>Eight, not twenty-two. We cannot inspect output quality in most Indian
 * languages, and offering one nobody has ever looked at is its own form of
 * overclaiming. Punjabi earns its place because the crop-residue corridor is
 * where behaviour is being asked to change, so the advisory that reaches those
 * farmers matters most.
 *
 * <p>{@code geminiName} is the name used in the prompt. It is written in
 * English because the instruction is in English; the output is not.
 */
public enum NarrativeLanguage {
    ENGLISH("en", "English", "English"),
    HINDI("hi", "हिन्दी", "Hindi"),
    PUNJABI("pa", "ਪੰਜਾਬੀ", "Punjabi"),
    URDU("ur", "اردو", "Urdu"),
    BENGALI("bn", "বাংলা", "Bengali"),
    MARATHI("mr", "मराठी", "Marathi"),
    TAMIL("ta", "தமிழ்", "Tamil"),
    TELUGU("te", "తెలుగు", "Telugu");

    private final String code;
    private final String displayName;
    private final String geminiName;

    NarrativeLanguage(String code, String displayName, String geminiName) {
        this.code = code;
        this.displayName = displayName;
        this.geminiName = geminiName;
    }

    public String code() {
        return code;
    }

    /** The language's name in itself, for a language picker. */
    public String displayName() {
        return displayName;
    }

    /** The name used when instructing the model. */
    public String geminiName() {
        return geminiName;
    }

    /**
     * @throws IllegalArgumentException on an unsupported code. Deliberately not
     *     a fallback to English: answering in a language nobody asked for,
     *     without saying so, is the same class of dishonesty as serving cached
     *     data as live.
     */
    public static NarrativeLanguage fromCode(String code) {
        if (code == null || code.isBlank()) {
            throw new IllegalArgumentException(
                    "A language code is required. Supported: " + supportedCodes());
        }
        String normalised = code.trim().toLowerCase();
        return Arrays.stream(values())
                .filter(language -> language.code.equals(normalised))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException(
                        "Unsupported language '" + code + "'. Supported: " + supportedCodes()));
    }

    private static String supportedCodes() {
        return Arrays.stream(values())
                .map(NarrativeLanguage::code)
                .collect(Collectors.joining(", "));
    }
}
