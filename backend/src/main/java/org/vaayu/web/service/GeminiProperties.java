package org.vaayu.web.service;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "vaayu.gemini")
public record GeminiProperties(String apiKey, String model) {}
