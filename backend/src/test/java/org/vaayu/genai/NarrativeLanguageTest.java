package org.vaayu.genai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Eight languages, chosen because we can inspect output in them. Twenty-two
 * scheduled languages were considered and rejected: offering a language nobody
 * has ever looked at is its own form of overclaiming.
 */
class NarrativeLanguageTest {

    @Test
    @DisplayName("the eight supported languages are present")
    void supportsEightLanguages() {
        assertThat(NarrativeLanguage.values()).hasSize(8);
        assertThat(NarrativeLanguage.fromCode("en")).isEqualTo(NarrativeLanguage.ENGLISH);
        assertThat(NarrativeLanguage.fromCode("pa")).isEqualTo(NarrativeLanguage.PUNJABI);
        assertThat(NarrativeLanguage.fromCode("ta")).isEqualTo(NarrativeLanguage.TAMIL);
    }

    @Test
    @DisplayName("an unsupported code is rejected rather than defaulted to English")
    void rejectsUnsupportedCode() {
        assertThatThrownBy(() -> NarrativeLanguage.fromCode("fr"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("fr")
                .hasMessageContaining("en");
    }

    @Test
    @DisplayName("a null or blank code is rejected, not treated as English")
    void rejectsAbsentCode() {
        assertThatThrownBy(() -> NarrativeLanguage.fromCode(null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> NarrativeLanguage.fromCode("  "))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("codes are matched case-insensitively")
    void matchesCaseInsensitively() {
        assertThat(NarrativeLanguage.fromCode("HI")).isEqualTo(NarrativeLanguage.HINDI);
    }

    @Test
    @DisplayName("every language names itself to Gemini in English")
    void everyLanguageHasAGeminiName() {
        for (NarrativeLanguage language : NarrativeLanguage.values()) {
            assertThat(language.geminiName()).isNotBlank();
            assertThat(language.displayName()).isNotBlank();
            assertThat(language.code()).hasSize(2);
        }
    }
}
