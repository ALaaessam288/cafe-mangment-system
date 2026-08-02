package com.example.cafemangmentsystem.menu.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record CategoryRequest(
        @NotBlank String nameAr,
        String nameEn,
        @NotNull @PositiveOrZero Integer displayOrder
) {
}