package com.example.cafemangmentsystem.employee.dto;

import com.example.cafemangmentsystem.employee.entity.EmployeeTransactionType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.LocalDate;

public record EmployeeTransactionRequest(
        @NotNull Long employeeId,
        @NotNull EmployeeTransactionType type,
        @NotNull @Positive BigDecimal amount,
        String notes,
        LocalDate transactionDate,
        Boolean paidFromDrawer
) {
}
