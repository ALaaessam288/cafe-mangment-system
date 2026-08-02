package com.example.cafemangmentsystem.order.dto;

import jakarta.validation.constraints.NotBlank;

public record CancelOrderItemRequest(
        @NotBlank String reason
) {
}