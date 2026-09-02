package com.example.cafemangmentsystem.ledger.dto;

import java.math.BigDecimal;
import java.time.Instant;

public record CashFlowReportResponse(
        Instant startDate,
        Instant endDate,
        BigDecimal cashSales,
        BigDecimal cashIn,
        BigDecimal debtCollected,
        BigDecimal totalCashInflows,
        BigDecimal cashExpenses,
        BigDecimal safeDrops,
        BigDecimal cashOut,
        BigDecimal staffAdvances,
        BigDecimal cashRefunds,
        BigDecimal totalCashOutflows,
        BigDecimal netCashChange
) {}
