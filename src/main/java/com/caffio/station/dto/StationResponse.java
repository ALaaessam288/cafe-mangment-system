package com.caffio.station.dto;

import com.caffio.station.entity.Station;
import com.caffio.station.entity.StationCode;

public record StationResponse(
        Long id,
        StationCode code,
        String nameAr,
        Long printerId
) {
    public static StationResponse from(Station station) {
        return new StationResponse(station.getId(), station.getCode(), station.getNameAr(),
                station.getPrinter() == null ? null : station.getPrinter().getId());
    }
}