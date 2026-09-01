package com.example.cafemangmentsystem.cashmovement.dto;

import java.math.BigDecimal;
import java.util.List;

public record CashDrawerSummaryDto(
        Long shiftId,
        BigDecimal openingFloat,
        BigDecimal cashSales,
        BigDecimal cashIn,
        BigDecimal safeDrops,
        BigDecimal cashOut,
        BigDecimal cashExpenses,
        BigDecimal debtCollectedCash,
        BigDecimal employeePaidOutCash,
        BigDecimal expectedCashInDrawer,
        List<CashMovementResponse> recentMovements
) {}
