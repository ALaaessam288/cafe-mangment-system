package com.example.cafemangmentsystem.report.dto;

import java.math.BigDecimal;

public record BestSellerDto(
        String productName,
        long totalQuantity,
        BigDecimal totalRevenue
) {}
