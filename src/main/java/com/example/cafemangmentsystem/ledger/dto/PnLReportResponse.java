package com.example.cafemangmentsystem.ledger.dto;

import java.math.BigDecimal;
import java.time.Instant;

public record PnLReportResponse(
        Instant startDate,
        Instant endDate,
        BigDecimal grossSales,
        BigDecimal refunds,
        BigDecimal netSales,
        BigDecimal directExpenses,
        BigDecimal payrollExpenses,
        BigDecimal totalExpenses,
        BigDecimal netProfit
) {}
