package com.example.cafemangmentsystem.menu.dto;

import jakarta.validation.constraints.NotNull;

public record AvailabilityRequest(
        @NotNull Boolean available
) {
}