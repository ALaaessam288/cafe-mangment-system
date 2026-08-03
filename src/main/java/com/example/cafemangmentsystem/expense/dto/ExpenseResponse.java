package com.example.cafemangmentsystem.expense.dto;

import com.example.cafemangmentsystem.expense.entity.Expense;
import com.example.cafemangmentsystem.expense.entity.ExpenseType;
import com.example.cafemangmentsystem.menu.entity.RevenueLine;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ExpenseResponse(
        Long id,
        ExpenseType type,
        RevenueLine revenueLine,
        BigDecimal amount,
        LocalDate expenseDate,
        boolean recurring,
        boolean paidFromDrawer,
        Long shiftId,
        Long recordedByUserId,
        Long employeeId,
        String employeeName
) {
    public static ExpenseResponse from(Expense expense) {
        return new ExpenseResponse(
                expense.getId(),
                expense.getType(),
                expense.getRevenueLine(),
                expense.getAmount(),
                expense.getExpenseDate(),
                expense.isRecurring(),
                expense.isPaidFromDrawer(),
                expense.getShift() == null ? null : expense.getShift().getId(),
                expense.getRecordedBy().getId(),
                expense.getEmployee() == null ? null : expense.getEmployee().getId(),
                expense.getEmployee() == null ? null : expense.getEmployee().getName()
        );
    }
}