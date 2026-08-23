package com.example.cafemangmentsystem.debt.dto;

import com.example.cafemangmentsystem.debt.entity.Debt;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record DebtResponse(
        Long id,
        String creditorName,
        BigDecimal amount,
        BigDecimal paidAmount,
        BigDecimal remainingAmount,
        String notes,
        LocalDate debtDate,
        LocalDate dueDate,
        boolean settled,
        Instant settledAt,
        boolean paidFromDrawer,
        String recordedByUsername,
        Instant createdAt
) {
    public static DebtResponse from(Debt debt) {
        BigDecimal paid = debt.getPaidAmount() != null ? debt.getPaidAmount() : BigDecimal.ZERO;
        BigDecimal remaining = debt.getAmount().subtract(paid);
        if (remaining.compareTo(BigDecimal.ZERO) < 0) {
            remaining = BigDecimal.ZERO;
        }
        return new DebtResponse(
                debt.getId(),
                debt.getCreditorName(),
                debt.getAmount(),
                paid,
                remaining,
                debt.getNotes(),
                debt.getDebtDate(),
                debt.getDueDate(),
                debt.isSettled(),
                debt.getSettledAt(),
                debt.isPaidFromDrawer(),
                debt.getRecordedBy() != null ? debt.getRecordedBy().getUsername() : null,
                debt.getCreatedAt());
    }
}