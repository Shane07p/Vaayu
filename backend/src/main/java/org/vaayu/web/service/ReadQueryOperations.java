package org.vaayu.web.service;

import java.util.List;
import java.util.Optional;
import org.vaayu.web.dto.AlertResponse;
import org.vaayu.web.dto.ForecastResponse;
import org.vaayu.web.dto.CityRankingResponse;
import org.vaayu.web.dto.DataQualityResponse;
import org.vaayu.web.dto.GridPredictionResponse;
import org.vaayu.web.dto.NearestStationResponse;
import org.vaayu.web.dto.ProvenanceResponse;
import org.vaayu.web.dto.StationReadingResponse;
import org.vaayu.web.dto.StationResponse;
import org.vaayu.web.dto.WorklistActionResponse;
import org.vaayu.web.dto.WorklistItemResponse;

/** Public read/write contract consumed by the HTTP controllers. */
public interface ReadQueryOperations {
    List<StationResponse> stations();

    List<StationReadingResponse> stationReadings();

    List<StationResponse> forecastStations();

    ProvenanceResponse provenance();

    DataQualityResponse dataQuality();

    Optional<NearestStationResponse> nearest(double lat, double lon);

    CityRankingResponse cityRankings(int limit);

    List<GridPredictionResponse> grid(double minLon, double minLat, double maxLon, double maxLat);

    List<ForecastResponse> forecast(long stationId);

    List<WorklistItemResponse> worklist(String receptor);

    List<AlertResponse> alerts();

    Optional<AlertResponse> alert(String alertId);

    WorklistActionResponse recordWorklistAction(long clusterId, String receptor, String actionedBy);
}
