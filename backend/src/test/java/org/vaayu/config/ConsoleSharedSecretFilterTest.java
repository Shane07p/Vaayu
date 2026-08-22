package org.vaayu.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mockito;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

/**
 * Everything behind this filter can dispatch an officer to a village, so a
 * bypass is not a cosmetic defect. Each test here covers a way the previous
 * implementation could be walked around.
 */
class ConsoleSharedSecretFilterTest {

    private static final String SECRET = "test-secret";

    private ConsoleSharedSecretFilter filter() {
        return new ConsoleSharedSecretFilter(SECRET);
    }

    private MockHttpServletRequest request(String method, String path) {
        var request = new MockHttpServletRequest(method, path);
        request.setServletPath(path);
        return request;
    }

    @Test
    void protectedPathWithoutSecretIsRejected() throws Exception {
        var response = new MockHttpServletResponse();
        var chain = Mockito.mock(FilterChain.class);

        filter().doFilter(request("GET", "/api/v1/worklist"), response, chain);

        assertThat(response.getStatus()).isEqualTo(401);
        Mockito.verify(chain, Mockito.never()).doFilter(Mockito.any(), Mockito.any());
    }

    @Test
    void protectedPathWithCorrectSecretPassesThrough() throws Exception {
        var request = request("GET", "/api/v1/worklist");
        request.addHeader("X-Console-Secret", SECRET);
        var chain = Mockito.mock(FilterChain.class);

        filter().doFilter(request, new MockHttpServletResponse(), chain);

        Mockito.verify(chain).doFilter(Mockito.any(), Mockito.any());
    }

    @Test
    void percentEncodedPathDoesNotBypassTheFilter() throws Exception {
        // getRequestURI() is undecoded, so "%77orklist" does not literally start
        // with "/api/v1/worklist". Spring MVC decodes the same request and routes
        // it to the worklist controller, so matching on the raw URI let this
        // request through unauthenticated.
        var request = new MockHttpServletRequest("POST", "/api/v1/%77orklist/7/action");
        request.setServletPath("/api/v1/%77orklist/7/action");
        var response = new MockHttpServletResponse();
        var chain = Mockito.mock(FilterChain.class);

        filter().doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(401);
        Mockito.verify(chain, Mockito.never()).doFilter(Mockito.any(), Mockito.any());
    }

    @Test
    void doublyEncodedPathDoesNotBypassTheFilter() throws Exception {
        var request = new MockHttpServletRequest("POST", "/api/v1/%2577orklist/7/action");
        request.setServletPath("/api/v1/%2577orklist/7/action");
        var response = new MockHttpServletResponse();
        var chain = Mockito.mock(FilterChain.class);

        filter().doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(401);
    }

    @Test
    void blankSuppliedSecretIsRejected() throws Exception {
        var request = request("GET", "/api/v1/alerts");
        request.addHeader("X-Console-Secret", "");
        var response = new MockHttpServletResponse();

        filter().doFilter(request, response, Mockito.mock(FilterChain.class));

        assertThat(response.getStatus()).isEqualTo(401);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "   "})
    void blankConfiguredSecretRefusesToStart(String configured) {
        // An empty expected secret makes MessageDigest.isEqual(empty, empty) true,
        // so an empty header would authenticate and the console would be open
        // with nothing logged anywhere. Fail at startup instead.
        assertThatThrownBy(() -> new ConsoleSharedSecretFilter(configured))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("blank");
    }

    @Test
    void corsPreflightIsNotChallenged() throws Exception {
        // Preflight carries no custom headers by definition, so it can never
        // present the secret. Challenging it means the browser never sends the
        // real request and the console cannot call these endpoints at all.
        var response = new MockHttpServletResponse();
        var chain = Mockito.mock(FilterChain.class);

        filter().doFilter(request("OPTIONS", "/api/v1/worklist"), response, chain);

        assertThat(response.getStatus()).isEqualTo(200);
        Mockito.verify(chain).doFilter(Mockito.any(), Mockito.any());
    }

    @Test
    void publicPathsAreNotChallenged() throws Exception {
        var chain = Mockito.mock(FilterChain.class);

        filter().doFilter(
                request("GET", "/api/v1/public/stations"),
                new MockHttpServletResponse(),
                chain);

        Mockito.verify(chain).doFilter(Mockito.any(), Mockito.any());
    }

    @Test
    void similarlyNamedPublicPathIsNotAccidentallyProtected() throws Exception {
        // Prefix matching without a segment boundary would protect this too.
        var chain = Mockito.mock(FilterChain.class);

        filter().doFilter(
                request("GET", "/api/v1/alertsummary"),
                new MockHttpServletResponse(),
                chain);

        Mockito.verify(chain).doFilter(Mockito.any(), Mockito.any());
    }
}
