package com.example.cafemangmentsystem.expense.dto;

import com.example.cafemangmentsystem.expense.entity.Expense;
import com.example.cafemangmentsystem.expense.entity.ExpenseStatus;
import com.example.cafemangmentsystem.expense.entity.ExpenseType;
import com.example.cafemangmentsystem.menu.entity.RevenueLine;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record ExpenseResponse(
        Long id,
        ExpenseType type,
        RevenueLine revenueLine,
        ExpenseStatus status,
        BigDecimal amount,
        BigDecimal advanceAmount,
        BigDecimal actualAmount,
        BigDecimal returnedAmount,
        boolean isAdvance,
        Instant settledAt,
        Long settledByUserId,
        String settledByUserName,
        LocalDate expenseDate,
        boolean recurring,
        boolean paidFromDrawer,
        Long shiftId,
        Long recordedByUserId,
        String recordedByUserName,
        Long employeeId,
        String employeeName,
        String spenderName,
        String notes
) {
    public static ExpenseResponse from(Expense expense) {
        String effectiveSpender = expense.getSpenderName();
        if (effectiveSpender == null && expense.getEmployee() != null) {
            effectiveSpender = expense.getEmployee().getName() != null ? expense.getEmployee().getName() : expense.getEmployee().getFullName();
        }

        return new ExpenseResponse(
                expense.getId(),
                expense.getType(),
                expense.getRevenueLine(),
                expense.getStatus(),
                expense.getAmount(),
                expense.getAdvanceAmount(),
                expense.getActualAmount(),
                expense.getReturnedAmount(),
                expense.isAdvance(),
                expense.getSettledAt(),
                expense.getSettledBy() == null ? null : expense.getSettledBy().getId(),
                expense.getSettledBy() == null ? null : expense.getSettledBy().getFullName(),
                expense.getExpenseDate(),
                expense.isRecurring(),
                expense.isPaidFromDrawer(),
                expense.getShift() == null ? null : expense.getShift().getId(),
                expense.getRecordedBy().getId(),
                expense.getRecordedBy().getFullName(),
                expense.getEmployee() == null ? null : expense.getEmployee().getId(),
                effectiveSpender,
                effectiveSpender,
                expense.getNotes()
        );
    }
}