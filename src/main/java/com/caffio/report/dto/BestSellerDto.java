package com.caffio.report.dto;

import java.math.BigDecimal;

public record BestSellerDto(
        String productName,
        long totalQuantity,
        BigDecimal totalRevenue
) {}
