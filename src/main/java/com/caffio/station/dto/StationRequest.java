package com.caffio.station.dto;

import com.caffio.station.entity.StationCode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record StationRequest(
        @NotNull StationCode code,
        @NotBlank String nameAr
) {
}