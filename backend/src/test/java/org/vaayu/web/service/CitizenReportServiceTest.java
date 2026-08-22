package org.vaayu.web.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.sql.ResultSet;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcOperations;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;
import org.vaayu.web.dto.CitizenReportRequest;

class CitizenReportServiceTest {
    private final NamedParameterJdbcOperations jdbc = org.mockito.Mockito.mock(NamedParameterJdbcOperations.class);
    private final GeminiClassifier gemini = org.mockito.Mockito.mock(GeminiClassifier.class);
    private final CitizenReportService service = new CitizenReportService(jdbc, gemini);

    @BeforeEach
    void insertsAPendingReport() throws Exception {
        ResultSet resultSet = org.mockito.Mockito.mock(ResultSet.class);
        when(resultSet.getLong("id")).thenReturn(42L);
        when(resultSet.getObject("submitted_at", OffsetDateTime.class)).thenReturn(OffsetDateTime.parse("2026-08-21T10:00:00Z"));
        when(resultSet.getString("status")).thenReturn("PENDING");
        when(jdbc.queryForObject(any(String.class), any(SqlParameterSource.class), any(RowMapper.class)))
                .thenAnswer(invocation -> ((RowMapper<?>) invocation.getArgument(2)).mapRow(resultSet, 0));
    }

    @Test
    void keeps_location_only_reports_pending_without_calling_gemini() {
        var response = service.submit(new CitizenReportRequest(28.6, 77.2, null));

        assertThat(response.status()).isEqualTo("PENDING");
        assertThat(response.band()).isNull();
        assertThat(response.sourceUnavailable()).isFalse();
        verify(gemini, never()).classify(any());
    }

    @Test
    void accepts_only_a_valid_banded_assessment() {
        when(gemini.classify("https://storage.example/report.jpg"))
                .thenReturn(new GeminiAssessment("POOR", 0.62, "visible haze", false));

        var response = service.submit(new CitizenReportRequest(28.6, 77.2, "https://storage.example/report.jpg"));

        assertThat(response.status()).isEqualTo("ACCEPTED");
        assertThat(response.band()).isEqualTo("POOR");
        assertThat(response.confidence()).isEqualTo(0.62);
        verify(jdbc).update(contains("gemini_band"), anyMap());
    }

    @Test
    void leaves_report_pending_when_model_output_is_unusable() {
        // Previously this stamped the citizen's report REJECTED. The assessment
        // being malformed -- an unknown band, a confidence outside [0,1] -- is our
        // failure, not the submitter's, and REJECTED is terminal with no
        // reprocessing path. PENDING keeps the report eligible for a later pass
        // and matches how a genuine upstream outage is already handled.
        // REJECTED stays reserved for an actual judgement about the submission.
        when(gemini.classify("https://storage.example/report.jpg"))
                .thenReturn(new GeminiAssessment("HAZY", 1.2, "not valid", false));

        var response = service.submit(new CitizenReportRequest(28.6, 77.2, "https://storage.example/report.jpg"));

        assertThat(response.status()).isEqualTo("PENDING");
        assertThat(response.band()).isNull();
        assertThat(response.sourceUnavailable()).isTrue();
        verify(jdbc, never()).update(contains("REJECTED"), anyMap());
        verify(jdbc, never()).update(contains("gemini_band"), anyMap());
    }

    @Test
    void leaves_report_pending_when_gemini_is_unavailable() {
        when(gemini.classify("https://storage.example/report.jpg"))
                .thenReturn(GeminiAssessment.unavailable());

        var response = service.submit(new CitizenReportRequest(28.6, 77.2, "https://storage.example/report.jpg"));

        assertThat(response.status()).isEqualTo("PENDING");
        assertThat(response.sourceUnavailable()).isTrue();
        verify(jdbc, never()).update(contains("gemini_band"), anyMap());
    }
}
