package com.caffio.report.dto;

import java.math.BigDecimal;

public record HourlySlotDto(
        int hour,
        long orderCount,
        BigDecimal revenue
) {}
