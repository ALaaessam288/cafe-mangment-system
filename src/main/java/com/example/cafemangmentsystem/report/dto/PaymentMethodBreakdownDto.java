package com.example.cafemangmentsystem.report.dto;

import java.math.BigDecimal;

public record PaymentMethodBreakdownDto(
        String method,
        BigDecimal totalAmount,
        Long count
) {}
