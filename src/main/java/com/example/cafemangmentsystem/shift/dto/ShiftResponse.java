package com.example.cafemangmentsystem.shift.dto;

import com.example.cafemangmentsystem.shift.entity.Shift;

import java.math.BigDecimal;
import java.time.Instant;

public record ShiftResponse(
        Long id,
        Long userId,
        String username,
        String userFullName,
        Long registerId,
        String registerName,
        Instant openedAt,
        Instant closedAt,
        BigDecimal openingFloat,
        BigDecimal expectedCash,
        BigDecimal countedCash,
        BigDecimal variance,
        BigDecimal snacksNet
) {
    public static ShiftResponse from(Shift shift) {
        String fullName = shift.getUser() != null ? shift.getUser().getFullName() : null;
        return new ShiftResponse(
                shift.getId(),
                shift.getUser().getId(),
                shift.getUser().getUsername(),
                fullName != null && !fullName.isBlank() ? fullName : (shift.getUser() != null ? shift.getUser().getUsername() : null),
                shift.getRegister().getId(),
                shift.getRegister().getName(),
                shift.getOpenedAt(),
                shift.getClosedAt(),
                shift.getOpeningFloat(),
                shift.getExpectedCash(),
                shift.getCountedCash(),
                shift.getVariance(),
                shift.getSnacksNet() != null ? shift.getSnacksNet() : BigDecimal.ZERO);
    }
}