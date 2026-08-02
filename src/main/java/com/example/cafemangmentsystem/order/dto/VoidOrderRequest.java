package com.example.cafemangmentsystem.order.dto;

import jakarta.validation.constraints.NotBlank;

public record VoidOrderRequest(
        @NotBlank String reason
) {
}