package com.example.cafemangmentsystem.expense.dto;

import com.example.cafemangmentsystem.expense.entity.ExpenseType;
import com.example.cafemangmentsystem.menu.entity.RevenueLine;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ExpenseRequest(
        @NotNull ExpenseType type,
        @NotNull RevenueLine revenueLine,
        @NotNull @Positive BigDecimal amount,
        @NotNull LocalDate expenseDate,
        boolean recurring,
        boolean paidFromDrawer,
        boolean isAdvance,
        Long employeeId,
        String notes
) {
    public ExpenseRequest(
            ExpenseType type,
            RevenueLine revenueLine,
            BigDecimal amount,
            LocalDate expenseDate,
            boolean recurring,
            boolean paidFromDrawer,
            Long employeeId,
            String notes
    ) {
        this(type, revenueLine, amount, expenseDate, recurring, paidFromDrawer, false, employeeId, notes);
    }
}