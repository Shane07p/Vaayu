package org.vaayu.web;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.vaayu.web.dto.AlertResponse;
import org.vaayu.web.dto.WorklistItemResponse;
import org.vaayu.web.service.ReadQueryService;

/** Authority-console API. Authentication is supplied by the deployment boundary for now. */
@RestController
@RequestMapping("/api/v1")
public class ConsoleController {
    private final ReadQueryService queries;

    public ConsoleController(ReadQueryService queries) {
        this.queries = queries;
    }

    @GetMapping("/worklist")
    public List<WorklistItemResponse> worklist(
            @RequestParam(defaultValue = "DELHI-NCR") String receptor) {
        if (receptor.isBlank() || receptor.length() > 100) {
            throw new IllegalArgumentException("receptor must contain 1 to 100 characters");
        }
        return queries.worklist(receptor);
    }

    @GetMapping("/alerts")
    public List<AlertResponse> alerts() {
        return queries.alerts();
    }
}
