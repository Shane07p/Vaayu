package org.vaayu.web;

import jakarta.validation.Valid;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.NoSuchElementException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.vaayu.genai.GroundedNarrator;
import org.vaayu.genai.Narrative;
import org.vaayu.genai.NarrativeFacts;
import org.vaayu.genai.NarrativeLanguage;
import org.vaayu.web.dto.CitizenReportRequest;
import org.vaayu.web.dto.CitizenReportResponse;
import org.vaayu.web.dto.ForecastResponse;
import org.vaayu.web.dto.CityRankingResponse;
import org.vaayu.web.dto.DataQualityResponse;
import org.vaayu.web.dto.GridPredictionResponse;
import org.vaayu.web.dto.NarrativeResponse;
import org.vaayu.web.dto.NearestStationResponse;
import org.vaayu.web.dto.ProvenanceResponse;
import org.vaayu.web.dto.StationReadingResponse;
import org.vaayu.web.dto.StationResponse;
import org.vaayu.web.service.CitizenReportService;
import org.vaayu.web.service.ReadQueryOperations;

/** Public, read-only data surface plus anonymous citizen report intake. */
@RestController
@RequestMapping("/api/v1/public")
@Tag(name = "Public data", description = "Observed, modelled, and fixture-backed data. SEED and FIXTURE values must be displayed as CACHED.")
public class PublicController {
    private final ReadQueryOperations queries;
    private final CitizenReportService reports;

    private final GroundedNarrator narrator;

    public PublicController(
            ReadQueryOperations queries, CitizenReportService reports, GroundedNarrator narrator) {
        this.queries = queries;
        this.reports = reports;
        this.narrator = narrator;
    }

    /**
     * The framing for a resident. Health guidance, not enforcement.
     *
     * <p>A citizen advisory written only in English does not serve the people
     * most exposed, which is why the language is a parameter rather than a
     * translation step applied afterwards.
     */
    private static final String RESIDENT_ROLE =
            """
            You are advising a resident of an Indian city about the air quality \
            near them. Say what the air is like and what they should do today. \
            Be practical and calm. Do not give medical advice.""";

    @GetMapping("/advisory")
    @Operation(summary = "Plain-language air quality advisory for a point, in the requested language")
    public NarrativeResponse advisory(
            @RequestParam(defaultValue = "en") String lang,
            @RequestParam double lat,
            @RequestParam double lon) {
        NarrativeLanguage language = NarrativeLanguage.fromCode(lang);
        NearestStationResponse station = queries.nearest(lat, lon)
                .orElseThrow(() -> new NoSuchElementException("no station reports near this point"));

        NarrativeFacts facts = NarrativeFacts.builder()
                .number("AQI", station.aqi())
                .number("PM2.5 in micrograms per cubic metre", station.pm25())
                // The distance is the substance, not a caveat: a measurement
                // taken kilometres away is not a measurement of here, and the
                // narrative must be able to say so.
                .number("Distance in kilometres", station.distanceKm())
                .fact("Station", station.name())
                .fact("City", station.city())
                .fact("Reading is recent", station.stale() ? "no" : "yes")
                .build();

        Narrative narrative = narrator.narrate(RESIDENT_ROLE, facts, language);
        return new NarrativeResponse(
                narrative.text(),
                narrative.language().code(),
                narrative.status().name(),
                narrative.unsourcedNumbers(),
                facts.asMap());
    }

    @GetMapping("/provenance")
    @Operation(summary = "Report where the data on screen came from, derived from ingestion_run and model_run")
    public ProvenanceResponse provenance() {
        return queries.provenance();
    }

    @GetMapping("/data-quality")
    @Operation(summary = "Readings withheld from public results while sensor-quality concerns are reviewed")
    public DataQualityResponse dataQuality() {
        return queries.dataQuality();
    }

    @GetMapping("/cities/rankings")
    @Operation(summary = "Cities ranked by their worst current station reading")
    public CityRankingResponse cityRankings(@RequestParam(defaultValue = "10") int limit) {
        if (limit < 1 || limit > 100) {
            throw new IllegalArgumentException("limit must be between 1 and 100");
        }
        return queries.cityRankings(limit);
    }

    @GetMapping("/nearest")
    @Operation(summary = "Nearest station to a point, its last reading, and how far away it is")
    public ResponseEntity<NearestStationResponse> nearest(
            @RequestParam double lat, @RequestParam double lon) {
        if (!Double.isFinite(lat) || lat < -90 || lat > 90) {
            throw new IllegalArgumentException("lat must be between -90 and 90");
        }
        if (!Double.isFinite(lon) || lon < -180 || lon > 180) {
            throw new IllegalArgumentException("lon must be between -180 and 180");
        }
        // 404 when no station has ever reported. An empty body would be
        // indistinguishable from a station reading of nothing.
        return queries.nearest(lat, lon)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/stations/readings")
    @Operation(summary = "Every station with a reading, and that reading")
    public List<StationReadingResponse> stationReadings() {
        return queries.stationReadings();
    }

    @GetMapping("/stations/forecastable")
    @Operation(summary = "Stations that have a forecast, so a caller can ask one that can answer")
    public List<StationResponse> forecastStations() {
        return queries.forecastStations();
    }

    @GetMapping("/stations")
    @Operation(summary = "List monitoring stations")
    public List<StationResponse> stations() {
        return queries.stations();
    }

    @GetMapping("/grid")
    @Operation(summary = "Read latest 1 km PM2.5 prediction cells within a bounding box")
    public List<GridPredictionResponse> grid(@RequestParam String bbox) {
        Bbox parsed = Bbox.parse(bbox);
        return queries.grid(parsed.minLon(), parsed.minLat(), parsed.maxLon(), parsed.maxLat());
    }

    @GetMapping("/forecast")
    @Operation(summary = "Read the latest 6, 24, and 72 hour forecast for a station")
    public List<ForecastResponse> forecast(@RequestParam long stationId) {
        if (stationId < 1) {
            throw new IllegalArgumentException("stationId must be positive");
        }
        return queries.forecast(stationId);
    }

    @PostMapping("/reports")
    @Operation(summary = "Submit a coarse-location citizen observation; photo output is always a band, never a concentration")
    @ResponseStatus(HttpStatus.CREATED)
    public CitizenReportResponse report(@Valid @RequestBody CitizenReportRequest request) {
        return reports.submit(request);
    }

    private record Bbox(double minLon, double minLat, double maxLon, double maxLat) {
        private static Bbox parse(String value) {
            String[] values = value.split(",", -1);
            if (values.length != 4) {
                throw new IllegalArgumentException("bbox must be minLon,minLat,maxLon,maxLat");
            }
            try {
                Bbox bbox = new Bbox(
                        Double.parseDouble(values[0]), Double.parseDouble(values[1]),
                        Double.parseDouble(values[2]), Double.parseDouble(values[3]));
                if (!Double.isFinite(bbox.minLon) || !Double.isFinite(bbox.minLat)
                        || !Double.isFinite(bbox.maxLon) || !Double.isFinite(bbox.maxLat)
                        || bbox.minLon < -180 || bbox.maxLon > 180 || bbox.minLat < -90
                        || bbox.maxLat > 90 || bbox.minLon >= bbox.maxLon || bbox.minLat >= bbox.maxLat) {
                    throw new IllegalArgumentException("bbox is outside valid geographic bounds");
                }
                return bbox;
            } catch (NumberFormatException exception) {
                throw new IllegalArgumentException("bbox values must be numbers", exception);
            }
        }
    }
}
