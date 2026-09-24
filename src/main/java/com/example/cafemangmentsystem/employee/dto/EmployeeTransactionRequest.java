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
        /* Required for DEDUCTION - see EmployeePayrollService.createTransaction. Not annotated
           @NotBlank because it is only mandatory for one of the three types, and a bean-validation
           annotation cannot say "unless this other field is ADVANCE". */
        String notes,
        LocalDate transactionDate,
        Boolean paidFromDrawer
) {
}
