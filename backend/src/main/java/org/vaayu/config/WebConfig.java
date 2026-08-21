package org.vaayu.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Allows the separately served web console without opening the API to every origin. */
@Configuration
public class WebConfig implements WebMvcConfigurer {
    private final String webOrigin;

    public WebConfig(@Value("${vaayu.web.allowed-origin:http://localhost:3000}") String webOrigin) {
        this.webOrigin = webOrigin;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(webOrigin)
                .allowedMethods("GET", "POST")
                .allowedHeaders("Content-Type", "X-Console-Secret", "X-Console-Actor")
                .maxAge(3_600);
    }
}
