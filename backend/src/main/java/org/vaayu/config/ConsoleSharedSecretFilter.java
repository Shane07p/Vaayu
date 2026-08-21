package org.vaayu.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Protects authority-console routes until a real identity provider is introduced. */
@Component
public class ConsoleSharedSecretFilter extends OncePerRequestFilter {
    private static final String SECRET_HEADER = "X-Console-Secret";

    private final byte[] expectedSecret;

    public ConsoleSharedSecretFilter(
            @Value("${vaayu.console.shared-secret}") String sharedSecret) {
        this.expectedSecret = sharedSecret.getBytes(StandardCharsets.UTF_8);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return !(path.startsWith("/api/v1/alerts") || path.startsWith("/api/v1/worklist"));
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String suppliedSecret = request.getHeader(SECRET_HEADER);
        boolean valid = suppliedSecret != null && MessageDigest.isEqual(
                expectedSecret, suppliedSecret.getBytes(StandardCharsets.UTF_8));
        if (!valid) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write("{\"code\":\"UNAUTHORIZED\",\"message\":\"X-Console-Secret is required\"}");
            return;
        }
        filterChain.doFilter(request, response);
    }
}
