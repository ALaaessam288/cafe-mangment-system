package com.example.cafemangmentsystem.order.dto;

import com.example.cafemangmentsystem.order.entity.OrderType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record OpenOrderRequest(
        @NotNull OrderType type,
        Long tableId,
        @Positive Integer guestCount
) {
}