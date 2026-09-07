package org.vaayu.web.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/** Small, auditable Gemini REST client for the citizen-report evidence path. */
@Component
public class GeminiClient implements GeminiClassifier, GeminiTextGenerator {
    private static final String PROMPT = """
            You classify a citizen-supplied sky or haze photograph as soft air-quality evidence.
            Return JSON only with band, confidence, and reasoning. band must be exactly one of
            GOOD, MODERATE, POOR, or SEVERE. confidence must be from 0 to 1. Never return,
            infer, or mention a PM2.5 concentration or any other numeric pollutant value.
            A photo can be misleading because clouds, light, and camera processing resemble haze.
            """;

    private final GeminiProperties properties;
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(5);
    private static final Duration READ_TIMEOUT = Duration.ofSeconds(10);

    /**
     * Narratives get longer than a classification does.
     *
     * <p>Classifying a photograph returns one band and one confidence, and ten
     * seconds is generous for it. Generating four sentences of grounded prose
     * measured at about twenty seconds against the configured model, so the
     * shared ten second read timeout aborted every narrative -- and, because the
     * narrator converts any transport failure into SOURCE_UNAVAILABLE, it
     * reported the model as unreachable when the model was answering perfectly
     * well. Forty-five seconds leaves room for a longer prompt or a slower day
     * without letting a genuinely hung request pin a thread.
     */
    private static final Duration TEXT_READ_TIMEOUT = Duration.ofSeconds(45);

    private final RestClient client;
    private final RestClient textClient;
    private final ObjectMapper objectMapper;

    public GeminiClient(GeminiProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        // A read timeout alone is not enough. The JDK HTTP client's default
        // connect timeout is infinite, so a blackholed endpoint -- one that
        // accepts nothing and never resets -- hangs the calling thread forever
        // rather than for ten seconds. The connect timeout has to be set on the
        // HttpClient itself; JdkClientHttpRequestFactory only exposes the read
        // timeout.
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(CONNECT_TIMEOUT)
                .build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(httpClient);
        factory.setReadTimeout(READ_TIMEOUT);
        this.client = RestClient.builder().requestFactory(factory).build();

        // A second factory rather than a longer shared timeout: raising the
        // classification timeout to suit narratives would make a hung photo
        // request hold a thread four times as long for no benefit.
        JdkClientHttpRequestFactory textFactory = new JdkClientHttpRequestFactory(httpClient);
        textFactory.setReadTimeout(TEXT_READ_TIMEOUT);
        this.textClient = RestClient.builder().requestFactory(textFactory).build();
    }

    /**
     * The supplied URI is an object-storage URI produced by the upload boundary. Gemini receives
     * the image as file_data; the API does not accept arbitrary user text as a substitute image.
     */
    @CircuitBreaker(name = "gemini", fallbackMethod = "unavailable")
    public GeminiAssessment classify(String photoUri) {
        if (properties.apiKey() == null || properties.apiKey().isBlank()) {
            throw new IllegalStateException("Gemini is not configured");
        }
        Map<String, Object> body = Map.of(
                "systemInstruction", Map.of("parts", List.of(Map.of("text", PROMPT))),
                "generationConfig", Map.of("responseMimeType", "application/json"),
                "contents", List.of(Map.of("role", "user", "parts", List.of(
                        Map.of("text", "Classify this photo as a coarse evidence band."),
                        Map.of("fileData", Map.of("mimeType", "image/jpeg", "fileUri", photoUri))))));
        String response = client.post()
                .uri("https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}",
                        properties.model(), properties.apiKey())
                .body(body)
                .retrieve()
                .body(String.class);
        return parse(response);
    }

    /**
     * Plain text generation, for narratives.
     *
     * <p>No responseMimeType is set: unlike photo classification, which asks for
     * JSON, this asks for prose. The grounding check runs on what comes back.
     */
    @Override
    public String generateText(String systemPrompt, String userPrompt) {
        if (properties.apiKey() == null || properties.apiKey().isBlank()) {
            throw new IllegalStateException("Gemini is not configured");
        }
        Map<String, Object> body = Map.of(
                "systemInstruction", Map.of("parts", List.of(Map.of("text", systemPrompt))),
                "contents",
                List.of(Map.of("role", "user", "parts", List.of(Map.of("text", userPrompt)))));
        String response = textClient.post()
                .uri("https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}",
                        properties.model(), properties.apiKey())
                .body(body)
                .retrieve()
                .body(String.class);
        return firstTextPart(response);
    }

    private String firstTextPart(String response) {
        try {
            JsonNode root = objectMapper.readTree(response);
            JsonNode text =
                    root.path("candidates").path(0).path("content").path("parts").path(0).path("text");
            if (text.isMissingNode() || text.asText().isBlank()) {
                throw new IllegalStateException("Gemini returned no text");
            }
            return text.asText();
        } catch (JsonProcessingException exc) {
            throw new IllegalStateException("Gemini returned unreadable JSON", exc);
        }
    }

    public GeminiAssessment unavailable(String photoUri, Throwable ignored) {
        return GeminiAssessment.unavailable();
    }

    private GeminiAssessment parse(String response) {
        try {
            JsonNode root = objectMapper.readTree(response);
            String text = root.at("/candidates/0/content/parts/0/text").asText(null);
            if (text == null || text.isBlank()) {
                throw new IllegalArgumentException("Gemini returned no structured assessment");
            }
            JsonNode assessment = objectMapper.readTree(text);
            String band = assessment.path("band").asText(null);
            JsonNode confidence = assessment.path("confidence");
            Double confidenceValue = confidence.isNumber() ? confidence.doubleValue() : null;
            return new GeminiAssessment(band, confidenceValue, assessment.path("reasoning").asText(""), false);
        } catch (Exception exception) {
            throw new IllegalArgumentException("Gemini returned invalid JSON", exception);
        }
    }
}
