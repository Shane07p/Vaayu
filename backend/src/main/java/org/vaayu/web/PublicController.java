package org.vaayu.web;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.vaayu.web.dto.CitizenReportRequest;
import org.vaayu.web.dto.CitizenReportResponse;
import org.vaayu.web.dto.ForecastResponse;
import org.vaayu.web.dto.GridPredictionResponse;
import org.vaayu.web.dto.StationResponse;
import org.vaayu.web.service.CitizenReportService;
import org.vaayu.web.service.ReadQueryService;

/** Public, read-only data surface plus anonymous citizen report intake. */
@RestController
@RequestMapping("/api/v1/public")
public class PublicController {
    private final ReadQueryService queries;
    private final CitizenReportService reports;

    public PublicController(ReadQueryService queries, CitizenReportService reports) {
        this.queries = queries;
        this.reports = reports;
    }

    @GetMapping("/stations")
    public List<StationResponse> stations() {
        return queries.stations();
    }

    @GetMapping("/grid")
    public List<GridPredictionResponse> grid(@RequestParam String bbox) {
        Bbox parsed = Bbox.parse(bbox);
        return queries.grid(parsed.minLon(), parsed.minLat(), parsed.maxLon(), parsed.maxLat());
    }

    @GetMapping("/forecast")
    public List<ForecastResponse> forecast(@RequestParam long stationId) {
        if (stationId < 1) {
            throw new IllegalArgumentException("stationId must be positive");
        }
        return queries.forecast(stationId);
    }

    @PostMapping("/reports")
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
