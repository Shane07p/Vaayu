package org.vaayu.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Stub security for the scaffold.
 *
 * <p>Console routes are intended to sit behind a shared secret; this is not an
 * identity provider and must be replaced before any deployment. Actuator and
 * the OpenAPI UI are open so the compose health check and API docs work without
 * credentials.
 */
@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(
                        "/actuator/**",
                        "/swagger-ui/**",
                        "/swagger-ui.html",
                        "/v3/api-docs/**").permitAll()
                .requestMatchers("/api/v1/public/**").permitAll()
                .anyRequest().permitAll());
        return http.build();
    }
}
