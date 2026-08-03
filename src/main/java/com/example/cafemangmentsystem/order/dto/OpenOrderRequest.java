package com.example.cafemangmentsystem.order.dto;

import com.example.cafemangmentsystem.order.entity.OrderType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.time.Instant;

public record OpenOrderRequest(
        @NotNull OrderType type,
        Long tableId,
        @Positive Integer guestCount,
        String customerName,
        String customerPhone,
        Instant pickupAt
) {
}