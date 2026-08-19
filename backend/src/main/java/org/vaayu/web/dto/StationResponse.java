package org.vaayu.web.dto;

public record StationResponse(
        long id, String code, String name, String city, String state, double lon, double lat, String source) {}
