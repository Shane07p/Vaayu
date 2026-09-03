package org.vaayu.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.NoSuchElementException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.vaayu.genai.GroundedNarrator;
import org.vaayu.genai.Narrative;
import org.vaayu.genai.NarrativeFacts;
import org.vaayu.genai.NarrativeLanguage;
import org.vaayu.web.dto.AlertResponse;
import org.vaayu.web.dto.NarrativeResponse;
import org.vaayu.web.dto.WorklistActionRequest;
import org.vaayu.web.dto.WorklistActionResponse;
import org.vaayu.web.dto.WorklistItemResponse;
import org.vaayu.web.service.ReadQueryOperations;

/** Authority-console API. Authentication is supplied by the deployment boundary for now. */
@RestController
@RequestMapping("/api/v1")
@Tag(name = "Authority console", description = "Requires the X-Console-Secret header.")
public class ConsoleController {

    /** Matches the @Size(max = 200) bound on WorklistActionRequest.actionedBy. */
    private static final int MAX_ACTOR_LENGTH = 200;

    private static final String DEFAULT_ACTOR = "console";

    /**
     * The framing for an officer. An alert that does not name a statute, an
     * officer and an action is not an alert; it is a chart.
     */
    private static final String OFFICER_ROLE =
            """
            You are briefing a district magistrate in India on an air quality alert. \
            Name the statutory basis, the jurisdiction, and the actions that must be \
            taken. Write plainly, as an official notice, not as advice.""";

    private final ReadQueryOperations queries;
    private final GroundedNarrator narrator;

    public ConsoleController(ReadQueryOperations queries, GroundedNarrator narrator) {
        this.queries = queries;
        this.narrator = narrator;
    }

    @GetMapping("/alerts/{alertId}/narrative")
    @Operation(
            summary =
                    "Officer briefing for an alert, generated and checked against the alert's own facts")
    public NarrativeResponse narrative(
            @PathVariable String alertId, @RequestParam(defaultValue = "en") String lang) {
        // Parsed before the alert is loaded: an unsupported language is the
        // caller's mistake and should not depend on whether the alert exists.
        NarrativeLanguage language = NarrativeLanguage.fromCode(lang);
        AlertResponse alert = queries.alert(alertId)
                .orElseThrow(() -> new NoSuchElementException("alert was not found"));

        NarrativeFacts facts = NarrativeFacts.builder()
                .number("Predicted AQI", alert.predictedAqi())
                .number("Interval low", alert.ciLow())
                .number("Interval high", alert.ciHigh())
                .number("Horizon hours", alert.horizonHours())
                // 48 hours is naturally written as 2 days. Supplied so the
                // narrative may say so without inventing arithmetic.
                .derived(alert.horizonHours() / 24)
                .fact("GRAP stage", alert.recommendedGrapStage())
                .fact("Statutory basis", alert.statutoryBasis())
                .fact("Jurisdiction", String.join(", ", alert.jurisdiction()))
                .fact("Mandated actions", String.join("; ", alert.mandatedActions()))
                .number("Exposed population", alert.exposedPopulation())
                .fact("Model version", alert.modelVersion())
                .build();

        Narrative narrative = narrator.narrate(OFFICER_ROLE, facts, language);
        return new NarrativeResponse(
                narrative.text(),
                narrative.language().code(),
                narrative.status().name(),
                narrative.unsourcedNumbers(),
                facts.asMap());
    }

    @GetMapping("/worklist")
    @Operation(summary = "Get the ranked fire-cluster worklist")
    public List<WorklistItemResponse> worklist(
            @RequestParam(defaultValue = "DELHI-NCR") String receptor) {
        if (receptor.isBlank() || receptor.length() > 100) {
            throw new IllegalArgumentException("receptor must contain 1 to 100 characters");
        }
        return queries.worklist(receptor);
    }

    @GetMapping("/alerts")
    @Operation(summary = "List the 50 most recently issued enforcement alerts")
    public List<AlertResponse> alerts() {
        return queries.alerts();
    }

    @GetMapping("/alerts/{alertId}")
    @Operation(summary = "Get one enforcement alert for the console deep-dive")
    public AlertResponse alert(@PathVariable String alertId) {
        return queries.alert(alertId)
                .orElseThrow(() -> new NoSuchElementException("alert was not found"));
    }

    @PostMapping("/worklist/{clusterId}/action")
    @Operation(summary = "Record that a district authority actioned a worklist cluster")
    public WorklistActionResponse action(
            @PathVariable long clusterId,
            @RequestParam(defaultValue = "DELHI-NCR") String receptor,
            @Valid @RequestBody(required = false) WorklistActionRequest request,
            @org.springframework.web.bind.annotation.RequestHeader(value = "X-Console-Actor", required = false)
                    String headerActor) {
        if (clusterId < 1 || receptor.isBlank() || receptor.length() > 100) {
            throw new IllegalArgumentException("clusterId and receptor must be valid");
        }
        String bodyActor = request == null ? null : request.actionedBy();
        String actionedBy = bodyActor != null && !bodyActor.isBlank()
                ? sanitiseActor(bodyActor)
                : sanitiseActor(headerActor);
        return queries.recordWorklistAction(clusterId, receptor, actionedBy);
    }

    /**
     * Normalise an actor identity before it reaches the audit column.
     *
     * <p>{@code actionedBy} in the request body is bounded by {@code @Size(max = 200)},
     * but the {@code X-Console-Actor} header bypassed that and reached the same
     * {@code fire_cluster_impact.actioned_by} column unvalidated. The column is
     * TEXT, so an oversized value is stored rather than rejected, and embedded
     * newlines let a caller forge additional lines in anything that renders the
     * audit trail.
     *
     * <p>This column records who ordered an enforcement action, so it should be
     * hard to write nonsense into.
     */
    private static String sanitiseActor(String candidate) {
        if (candidate == null || candidate.isBlank()) {
            return DEFAULT_ACTOR;
        }
        // Strip control characters, including CR and LF, so a value cannot span lines.
        String cleaned = candidate.replaceAll("\\p{Cntrl}", " ").trim();
        if (cleaned.isEmpty()) {
            return DEFAULT_ACTOR;
        }
        return cleaned.length() > MAX_ACTOR_LENGTH
                ? cleaned.substring(0, MAX_ACTOR_LENGTH)
                : cleaned;
    }
}
