package com.example.cafemangmentsystem.expense.dto;

import com.example.cafemangmentsystem.expense.entity.ExpenseType;
import com.example.cafemangmentsystem.menu.entity.RevenueLine;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ExpenseRequest(
        @NotNull(message = "نوع المصروف مطلوب")
        ExpenseType type,

        @NotNull(message = "بند الإيراد مطلوب")
        RevenueLine revenueLine,

        @NotNull(message = "مبلغ المصروف مطلوب")
        @Positive(message = "يجب أن يكون المبلغ أكبر من صفر")
        BigDecimal amount,

        @NotNull(message = "تاريخ المصروف مطلوب")
        LocalDate expenseDate,

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
