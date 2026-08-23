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
import org.vaayu.web.dto.AlertResponse;
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

    private final ReadQueryOperations queries;

    public ConsoleController(ReadQueryOperations queries) {
        this.queries = queries;
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
