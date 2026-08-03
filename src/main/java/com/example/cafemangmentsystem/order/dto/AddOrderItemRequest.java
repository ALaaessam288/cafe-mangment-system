package com.example.cafemangmentsystem.order.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.util.List;

public record AddOrderItemRequest(
        @NotNull Long productId,
        @Positive Integer quantity,
        String note,
        List<Long> optionIds
) {
}