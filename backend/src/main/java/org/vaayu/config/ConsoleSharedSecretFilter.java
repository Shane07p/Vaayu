package org.vaayu.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Protects authority-console routes until a real identity provider is introduced.
 *
 * <p>This is a stub, not an identity provider. It exists to keep the public
 * citizen surface and the enforcement console genuinely separate, and it is
 * replaced before any real deployment. Being a stub is not licence to be
 * bypassable, though: everything behind it can dispatch an officer.
 */
@Component
public class ConsoleSharedSecretFilter extends OncePerRequestFilter {

    private static final String SECRET_HEADER = "X-Console-Secret";

    private static final List<String> PROTECTED_PREFIXES =
            List.of("/api/v1/alerts", "/api/v1/worklist");

    private final byte[] expectedSecret;

    public ConsoleSharedSecretFilter(
            @Value("${vaayu.console.shared-secret}") String sharedSecret) {
        // Fail at startup rather than serving an open console. An empty secret
        // makes MessageDigest.isEqual(empty, empty) return true, so a request
        // carrying an empty X-Console-Secret header would authenticate and the
        // console would be wide open with no error anywhere.
        if (!StringUtils.hasText(sharedSecret)) {
            throw new IllegalStateException(
                    "vaayu.console.shared-secret is blank. Refusing to start: a blank "
                            + "secret authenticates any request carrying an empty "
                            + SECRET_HEADER
                            + " header, which silently disables console authentication.");
        }
        this.expectedSecret = sharedSecret.getBytes(StandardCharsets.UTF_8);
    }

    /**
     * The request path as Spring will route it: decoded, and without the context path.
     *
     * <p>{@code getRequestURI()} returns the raw, percent-encoded path. Matching a
     * prefix against it lets {@code /api/v1/%77orklist/7/action} slip past this
     * filter while Spring MVC decodes the same request and dispatches it to the
     * worklist controller. That is an authentication bypass, so the comparison
     * must happen on the decoded path.
     */
    private String routedPath(HttpServletRequest request) {
        String path = request.getServletPath();
        if (!StringUtils.hasText(path)) {
            // Fall back for servlet mappings where servletPath is empty, stripping
            // the context path so a deployment under a context root still matches.
            String uri = request.getRequestURI();
            String context = request.getContextPath();
            path = (StringUtils.hasText(context) && uri.startsWith(context))
                    ? uri.substring(context.length())
                    : uri;
        }
        // Decode repeatedly: a doubly-encoded path (%2577orklist) would otherwise
        // survive one pass and still reach the controller decoded.
        String previous;
        do {
            previous = path;
            path = URLDecoder.decode(path, StandardCharsets.UTF_8);
        } while (!path.equals(previous));

        return path;
    }

    private boolean isProtected(String path) {
        for (String prefix : PROTECTED_PREFIXES) {
            // Require a segment boundary so /api/v1/alertsomething does not match,
            // and so the exact collection path still does.
            if (path.equals(prefix) || path.startsWith(prefix + "/")) {
                return true;
            }
        }
        return false;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        // CORS preflight carries no custom headers by definition, so it can never
        // present X-Console-Secret. Rejecting it here means the browser never
        // sends the real request and the console cannot call these endpoints at
        // all. The preflight itself exposes nothing; the request it precedes is
        // still authenticated.
        if (HttpMethod.OPTIONS.matches(request.getMethod())) {
            return true;
        }
        return !isProtected(routedPath(request));
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String suppliedSecret = request.getHeader(SECRET_HEADER);
        boolean valid = StringUtils.hasText(suppliedSecret)
                && MessageDigest.isEqual(
                        expectedSecret, suppliedSecret.getBytes(StandardCharsets.UTF_8));
        if (!valid) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter()
                    .write("{\"code\":\"UNAUTHORIZED\",\"message\":\"X-Console-Secret is required\"}");
            return;
        }
        filterChain.doFilter(request, response);
    }
}
