package com.example.cafemangmentsystem.station.dto;

import jakarta.validation.constraints.NotNull;

public record AssignPrinterRequest(
        @NotNull Long printerId
) {
}