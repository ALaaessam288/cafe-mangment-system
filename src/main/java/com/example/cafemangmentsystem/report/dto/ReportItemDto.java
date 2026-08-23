package com.example.cafemangmentsystem.report.dto;

import java.math.BigDecimal;

public record ReportItemDto(
        String name,
        Long quantity,
        BigDecimal totalRevenue
) {}
