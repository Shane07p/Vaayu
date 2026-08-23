package org.vaayu.web;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.NoSuchElementException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.vaayu.config.ConsoleSharedSecretFilter;
import org.vaayu.config.SecurityConfig;
import org.vaayu.web.dto.AlertResponse;
import org.vaayu.web.dto.WorklistActionResponse;
import org.vaayu.genai.GroundedNarrator;
import org.vaayu.web.service.ReadQueryOperations;

@WebMvcTest(ConsoleController.class)
@Import({ApiExceptionHandler.class, ConsoleSharedSecretFilter.class, SecurityConfig.class})
@TestPropertySource(properties = "vaayu.console.shared-secret=test-secret")
class ConsoleControllerTest {
    @Autowired
    private MockMvc mvc;

    @MockBean
    private ReadQueryOperations queries;

    // The controller now takes a narrator for the briefing endpoint. This test
    // exercises the console's auth boundary, not generation, so a bare mock is
    // enough -- but the context will not load without it.
    @MockBean
    private GroundedNarrator narrator;

    @Test
    void rejects_console_requests_without_the_shared_secret() throws Exception {
        mvc.perform(get("/api/v1/alerts"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void returns_alerts_for_an_authorized_console_request() throws Exception {
        when(queries.alerts()).thenReturn(List.of(alert()));

        mvc.perform(get("/api/v1/alerts").header("X-Console-Secret", "test-secret"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].alertId").value("VAAYU-1"));
    }

    @Test
    void returns_not_found_for_an_unknown_alert() throws Exception {
        when(queries.alert("unknown")).thenThrow(new NoSuchElementException("alert was not found"));

        mvc.perform(get("/api/v1/alerts/unknown").header("X-Console-Secret", "test-secret"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void records_an_authorized_worklist_action() throws Exception {
        when(queries.recordWorklistAction(7L, "DELHI-NCR", "DM Patel"))
                .thenReturn(new WorklistActionResponse("PB-001", OffsetDateTime.parse("2026-08-21T10:00:00Z"), "DM Patel"));

        mvc.perform(post("/api/v1/worklist/7/action")
                        .header("X-Console-Secret", "test-secret")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"actionedBy\":\"DM Patel\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.clusterCode").value("PB-001"));
    }

    private static AlertResponse alert() {
        return new AlertResponse(
                "VAAYU-1", OffsetDateTime.parse("2026-08-21T10:00:00Z"), 24, 428, 391, 461,
                "III", "basis", List.of("DPCC"), List.of("close_brick_kilns"), 10L,
                "v1", List.of("CPCB"), "CPCB");
    }
}
