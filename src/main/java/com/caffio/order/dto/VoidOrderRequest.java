package com.caffio.order.dto;

import jakarta.validation.constraints.NotBlank;

public record VoidOrderRequest(
        @NotBlank String reason
) {
}