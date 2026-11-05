package com.caffio.report.dto;

import java.math.BigDecimal;

public record ReportItemDto(
        String name,
        Long quantity,
        BigDecimal totalRevenue
) {}
