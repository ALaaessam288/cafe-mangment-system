package com.example.cafemangmentsystem.cashmovement.dto;

import com.example.cafemangmentsystem.cashmovement.entity.CashMovement;
import com.example.cafemangmentsystem.cashmovement.entity.CashMovementType;

import java.math.BigDecimal;
import java.time.Instant;

public record CashMovementResponse(
        Long id,
        Long shiftId,
        Long registerId,
        String registerName,
        Long performedById,
        String performedByName,
        CashMovementType type,
        BigDecimal amount,
        String reason,
        String receiptNumber,
        Instant performedAt
) {
    public static CashMovementResponse from(CashMovement m) {
        return new CashMovementResponse(
                m.getId(),
                m.getShift() != null ? m.getShift().getId() : null,
                m.getRegister() != null ? m.getRegister().getId() : null,
                m.getRegister() != null ? m.getRegister().getName() : null,
                m.getPerformedBy() != null ? m.getPerformedBy().getId() : null,
                m.getPerformedBy() != null ? m.getPerformedBy().getFullName() : null,
                m.getType(),
                m.getAmount(),
                m.getReason(),
                m.getReceiptNumber(),
                m.getPerformedAt()
        );
    }
}
