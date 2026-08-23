package com.example.cafemangmentsystem.debt.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.LocalDate;

public record DebtRequest(
        @NotBlank String creditorName,
        @NotNull @Positive BigDecimal amount,
        String notes,
        LocalDate debtDate,
        LocalDate dueDate
) {
}