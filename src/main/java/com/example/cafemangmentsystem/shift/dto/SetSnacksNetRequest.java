package com.example.cafemangmentsystem.shift.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;

public record SetSnacksNetRequest(
        @NotNull @PositiveOrZero BigDecimal amount
) {
}
