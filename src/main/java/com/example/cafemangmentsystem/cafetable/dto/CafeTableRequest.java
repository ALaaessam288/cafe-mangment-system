package com.example.cafemangmentsystem.cafetable.dto;

import com.example.cafemangmentsystem.cafetable.entity.TableZone;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record CafeTableRequest(
        @NotNull @Positive Integer number,
        @NotNull TableZone zone,
        @NotNull @Positive Integer seats
) {
}