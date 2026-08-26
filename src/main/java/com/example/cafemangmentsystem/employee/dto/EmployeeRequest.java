package com.example.cafemangmentsystem.employee.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record EmployeeRequest(
        @NotBlank String name,
        String jobTitle,
        @NotNull BigDecimal baseSalary,
        String salaryPeriod,
        Boolean active
) {}
