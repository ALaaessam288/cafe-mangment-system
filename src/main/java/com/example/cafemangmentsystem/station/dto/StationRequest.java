package com.example.cafemangmentsystem.station.dto;

import com.example.cafemangmentsystem.station.entity.StationCode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record StationRequest(
        @NotNull StationCode code,
        @NotBlank String nameAr
) {
}