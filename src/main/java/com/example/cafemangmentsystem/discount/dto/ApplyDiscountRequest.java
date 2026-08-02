package com.example.cafemangmentsystem.discount.dto;

import com.example.cafemangmentsystem.discount.entity.DiscountType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;

public record ApplyDiscountRequest(
        @NotNull DiscountType type,
        @NotNull @Positive BigDecimal value,
        @PositiveOrZero BigDecimal maxValue,
        @NotBlank String reason
) {
}