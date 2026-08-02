package com.example.cafemangmentsystem.order.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record AddOrderItemRequest(
        @NotNull Long productId,
        @Positive Integer quantity,
        String note
) {
}