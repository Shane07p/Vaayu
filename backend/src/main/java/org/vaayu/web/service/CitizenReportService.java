package org.vaayu.web.service;

import java.time.OffsetDateTime;
import java.util.Set;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcOperations;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.vaayu.web.dto.CitizenReportRequest;
import org.vaayu.web.dto.CitizenReportResponse;

/** Stores only coarse location and optional object storage URI, never identity data. */
@Service
public class CitizenReportService {
    private static final Logger log = LoggerFactory.getLogger(CitizenReportService.class);

    private static final Set<String> ALLOWED_BANDS = Set.of("GOOD", "MODERATE", "POOR", "SEVERE");

    private final NamedParameterJdbcOperations jdbc;
    private final GeminiClassifier gemini;

    public CitizenReportService(NamedParameterJdbcOperations jdbc, GeminiClassifier gemini) {
        this.jdbc = jdbc;
        this.gemini = gemini;
    }

    /**
     * Record a citizen report, then classify its photograph.
     *
     * <p>Deliberately not {@code @Transactional}. The Gemini call is a blocking
     * outbound HTTP request, and holding a database connection across it means a
     * slow or unreachable model pins a Hikari connection for the duration. Enough
     * concurrent submissions and the pool is exhausted, which takes down every
     * endpoint, including the ones that have nothing to do with photographs.
     *
     * <p>Atomicity is not needed here: the insert stands on its own, and the
     * follow-up update is idempotent. A crash between them leaves the report
     * PENDING, which is exactly the state a not-yet-classified report should be in.
     */
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
            // The model returned something we could not read: an unknown band, a
            // confidence outside [0,1], or a missing field. That is our failure,
            // not the citizen's, and REJECTED is a terminal state with no
            // reprocessing path. Leaving the report PENDING keeps it eligible for
            // a later pass, and matches how a genuine upstream outage is handled
            // immediately above. REJECTED stays reserved for an actual judgement
            // about the submission.
            log.warn(
                    "Discarding unusable Gemini assessment for report {}: band={} confidence={}",
                    stored.id(),
                    assessment.band(),
                    assessment.confidence());
            return new CitizenReportResponse(
                    stored.id(), stored.submittedAt(), "PENDING", null, null, true);
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
