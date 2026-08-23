package com.example.cafemangmentsystem.debt.dto;

import java.math.BigDecimal;

public record SettleDebtRequest(
        Boolean paidFromDrawer,
        BigDecimal amount,
        String notes
) {
}