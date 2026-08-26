package com.example.cafemangmentsystem.expense.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

public record SettleExpenseRequest(
        @NotNull @Positive BigDecimal actualAmount,
        String notes
) {
}
