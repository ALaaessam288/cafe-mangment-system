package com.example.cafemangmentsystem.employee.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.math.BigDecimal;

public record EmployeeRequest(
        @NotBlank(message = "اسم الموظف مطلوب")
        String name,

        String jobTitle,

        @NotNull(message = "الراتب الأساسي مطلوب")
        @PositiveOrZero(message = "يجب ألا يكون الراتب سالباً")
        BigDecimal baseSalary,

        String salaryPeriod,
        Boolean active
) {}
