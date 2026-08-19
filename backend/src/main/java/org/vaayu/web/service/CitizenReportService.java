package org.vaayu.web.service;

import java.time.OffsetDateTime;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.vaayu.web.dto.CitizenReportRequest;
import org.vaayu.web.dto.CitizenReportResponse;

/** Stores only coarse location and optional object storage URI, never identity data. */
@Service
public class CitizenReportService {
    private final NamedParameterJdbcTemplate jdbc;

    public CitizenReportService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional
    public CitizenReportResponse submit(CitizenReportRequest request) {
        return jdbc.queryForObject(
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
                (rs, row) -> new CitizenReportResponse(
                        rs.getLong("id"),
                        rs.getObject("submitted_at", OffsetDateTime.class),
                        rs.getString("status")));
    }
}
