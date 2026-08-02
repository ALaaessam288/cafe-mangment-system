package com.example.cafemangmentsystem.shift.dto;

import com.example.cafemangmentsystem.shift.entity.Shift;

import java.math.BigDecimal;
import java.time.Instant;

public record ShiftResponse(
        Long id,
        Long userId,
        String username,
        Long registerId,
        String registerName,
        Instant openedAt,
        Instant closedAt,
        BigDecimal openingFloat,
        BigDecimal expectedCash,
        BigDecimal countedCash,
        BigDecimal variance
) {
    public static ShiftResponse from(Shift shift) {
        return new ShiftResponse(
                shift.getId(),
                shift.getUser().getId(),
                shift.getUser().getUsername(),
                shift.getRegister().getId(),
                shift.getRegister().getName(),
                shift.getOpenedAt(),
                shift.getClosedAt(),
                shift.getOpeningFloat(),
                shift.getExpectedCash(),
                shift.getCountedCash(),
                shift.getVariance());
    }
}