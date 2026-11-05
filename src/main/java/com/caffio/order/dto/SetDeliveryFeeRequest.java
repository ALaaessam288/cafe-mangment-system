package com.caffio.order.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;

public record SetDeliveryFeeRequest(
        @NotNull @PositiveOrZero BigDecimal amount
) {
}