package com.example.cafemangmentsystem.payment.dto;

import com.example.cafemangmentsystem.payment.entity.PaymentMethod;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;

public record RecordPaymentRequest(
        @NotNull PaymentMethod method,
        @NotNull @Positive BigDecimal amount,
        @PositiveOrZero BigDecimal received,
        String reference,
        String note
) {
}