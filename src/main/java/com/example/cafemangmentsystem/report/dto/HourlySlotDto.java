package com.example.cafemangmentsystem.report.dto;

import java.math.BigDecimal;

public record HourlySlotDto(
        int hour,
        long orderCount,
        BigDecimal revenue
) {}
