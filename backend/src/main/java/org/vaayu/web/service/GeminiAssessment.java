package org.vaayu.web.service;

/** Gemini is intentionally constrained to a coarse band, not a concentration. */
public record GeminiAssessment(String band, Double confidence, String reasoning, boolean sourceUnavailable) {
    static GeminiAssessment unavailable() {
        return new GeminiAssessment(null, null, null, true);
    }
}
