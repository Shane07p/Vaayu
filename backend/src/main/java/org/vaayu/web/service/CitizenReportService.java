package org.vaayu.web.service;

import java.time.OffsetDateTime;
import java.util.Set;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcOperations;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.vaayu.web.dto.CitizenReportRequest;
import org.vaayu.web.dto.CitizenReportResponse;

/** Stores only coarse location and optional object storage URI, never identity data. */
@Service
public class CitizenReportService {
    private static final Set<String> ALLOWED_BANDS = Set.of("GOOD", "MODERATE", "POOR", "SEVERE");

    private final NamedParameterJdbcOperations jdbc;
    private final GeminiClassifier gemini;

    public CitizenReportService(NamedParameterJdbcOperations jdbc, GeminiClassifier gemini) {
        this.jdbc = jdbc;
        this.gemini = gemini;
    }

    @Transactional
    public CitizenReportResponse submit(CitizenReportRequest request) {
        StoredReport stored = jdbc.queryForObject(
                """
                INSERT INTO citizen_report (geom, photo_uri, source)
                VALUES (ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography,
                        :photoUri, 'CITIZEN')
                RETURNING id, submitted_at, status
                """,
                new MapSqlParameterSource()
                        .addValue("latitude", request.latitude())
                        .addValue("longitude", request.longitude())
                        .addValue("photoUri", request.photoUri()),
                (rs, row) -> new StoredReport(
                        rs.getLong("id"),
                        rs.getObject("submitted_at", OffsetDateTime.class),
                        rs.getString("status")));
        if (request.photoUri() == null || request.photoUri().isBlank()) {
            return new CitizenReportResponse(
                    stored.id(), stored.submittedAt(), stored.status(), null, null, false);
        }

        GeminiAssessment assessment = gemini.classify(request.photoUri());
        if (assessment.sourceUnavailable()) {
            return new CitizenReportResponse(stored.id(), stored.submittedAt(), "PENDING", null, null, true);
        }
        if (!isValid(assessment)) {
            jdbc.update("UPDATE citizen_report SET status = 'REJECTED' WHERE id = :id", java.util.Map.of("id", stored.id()));
            return new CitizenReportResponse(stored.id(), stored.submittedAt(), "REJECTED", null, null, false);
        }
        jdbc.update(
                """
                UPDATE citizen_report
                SET gemini_band = :band, confidence = :confidence, status = 'ACCEPTED'
                WHERE id = :id
                """,
                java.util.Map.of("id", stored.id(), "band", assessment.band(), "confidence", assessment.confidence()));
        return new CitizenReportResponse(
                stored.id(), stored.submittedAt(), "ACCEPTED", assessment.band(), assessment.confidence(), false);
    }

    private static boolean isValid(GeminiAssessment assessment) {
        return assessment.band() != null
                && ALLOWED_BANDS.contains(assessment.band())
                && assessment.confidence() != null
                && assessment.confidence() >= 0
                && assessment.confidence() <= 1;
    }

    private record StoredReport(long id, OffsetDateTime submittedAt, String status) {}
}
