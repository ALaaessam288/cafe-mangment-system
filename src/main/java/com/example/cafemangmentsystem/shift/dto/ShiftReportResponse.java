package com.example.cafemangmentsystem.shift.dto;

import java.math.BigDecimal;

public record ShiftReportResponse(
        ShiftResponse shift,
        BigDecimal totalRevenue,
        BigDecimal totalCash,
        BigDecimal totalInstapay,
        BigDecimal totalWallet
) {
}
