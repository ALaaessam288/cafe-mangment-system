package com.example.cafemangmentsystem.employee.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.LocalDate;

public record EmployeeRequest(
        @NotBlank String fullName,
        String position,
        String phone,
        @NotNull @Positive BigDecimal dailyWage,
        LocalDate hireDate
) {
}