package com.example.cafemangmentsystem.shift.dto;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * A shift's reconciliation summary - safe to request before the shift is closed (expectedCash is
 * computed live the same way {@code ShiftService#closeInternal} computes it at close time), in
 * which case countedCash/variance are null since nothing has been counted yet.
 */
public record ShiftReportResponse(
        Long shiftId,
        Long userId,
        String cashierName,
        Long registerId,
        String registerName,
        Instant openedAt,
        Instant closedAt,
        int ordersCount,
        int voidedOrdersCount,
        BigDecimal grossSales,
        BigDecimal totalDiscount,
        BigDecimal netSales,
        BigDecimal cashCollected,
        BigDecimal walletCollected,
        BigDecimal instapayCollected,
        BigDecimal totalCollected,
        BigDecimal drawerExpenses,
        BigDecimal openingFloat,
        BigDecimal expectedCash,
        BigDecimal countedCash,
        BigDecimal variance
) {
}