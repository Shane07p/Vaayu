package org.vaayu.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Method;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * {@code fire_cluster_impact.actioned_by} records who ordered an enforcement
 * action, so it should be hard to write nonsense into.
 *
 * <p>The request body's {@code actionedBy} is bounded by {@code @Size(max = 200)},
 * but the {@code X-Console-Actor} header reached the same TEXT column with no
 * validation at all.
 */
class ConsoleActorSanitisationTest {

    private static Method sanitise;

    @BeforeAll
    static void lookUpTheHelper() throws Exception {
        sanitise = ConsoleController.class.getDeclaredMethod("sanitiseActor", String.class);
        sanitise.setAccessible(true);
    }

    private String sanitise(String candidate) throws Exception {
        return (String) sanitise.invoke(null, candidate);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "   ", "\t"})
    void blankIdentitiesFallBackToTheDefaultActor(String candidate) throws Exception {
        assertThat(sanitise(candidate)).isEqualTo("console");
    }

    @Test
    void nullIdentityFallsBackToTheDefaultActor() throws Exception {
        assertThat(sanitise(null)).isEqualTo("console");
    }

    @Test
    void ordinaryIdentityIsPreserved() throws Exception {
        assertThat(sanitise("  DM Amritsar  ")).isEqualTo("DM Amritsar");
    }

    @Test
    void oversizedIdentityIsTruncatedToTheBodyLimit() throws Exception {
        // The column is TEXT, so an oversized value is stored rather than
        // rejected. The header path bypassed the 200-character bound entirely.
        String candidate = "x".repeat(5_000);

        assertThat(sanitise(candidate)).hasSize(200);
    }

    @Test
    void newlinesCannotForgeAdditionalAuditLines() throws Exception {
        String newline = String.valueOf((char) 10);
        String forged = "officer" + newline + "ACTIONED_BY: someone-else";

        String cleaned = sanitise(forged);

        assertThat(cleaned).doesNotContain(newline);
        assertThat(cleaned).startsWith("officer");
    }

    @Test
    void controlCharactersAreStripped() throws Exception {
        // Built rather than written as a literal so the character survives
        // every editor and tool between here and the compiler.
        String bell = String.valueOf((char) 7);
        String cleaned = sanitise("a" + bell + "c");

        assertThat(cleaned).doesNotContain(bell);
        assertThat(cleaned).contains("a").contains("c");
    }

    @Test
    void identityMadeOnlyOfControlCharactersFallsBackToTheDefault() throws Exception {
        String controls = String.valueOf((char) 10) + (char) 13 + (char) 9;
        assertThat(sanitise(controls)).isEqualTo("console");
    }
}
