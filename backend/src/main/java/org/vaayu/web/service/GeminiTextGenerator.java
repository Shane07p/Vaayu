package org.vaayu.web.service;

/**
 * Text generation, separated from the client so the narrator can be tested
 * without HTTP. CI has no API key, which is the standing rule for every source
 * in this project.
 */
public interface GeminiTextGenerator {
    /**
     * @return the model's text response
     * @throws RuntimeException if the model cannot be reached; the narrator
     *     converts this to SOURCE_UNAVAILABLE
     */
    String generateText(String systemPrompt, String userPrompt);
}
