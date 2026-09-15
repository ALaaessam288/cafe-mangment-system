package com.example.cafemangmentsystem.menu.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record ProductOptionRequest(
        @NotBlank String nameAr,
        @NotNull BigDecimal priceDelta,
        boolean isDefault,
        /* SIZE | SUGAR | SPICE | ADDON. Null means ADDON, so older clients keep working. */
        String optionGroup
) {
}