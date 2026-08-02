package com.example.cafemangmentsystem.payment.dto;

import com.example.cafemangmentsystem.payment.entity.Payment;
import com.example.cafemangmentsystem.payment.entity.PaymentMethod;

import java.math.BigDecimal;
import java.time.Instant;

public record PaymentResponse(
        Long id,
        Long orderId,
        PaymentMethod method,
        BigDecimal amount,
        BigDecimal received,
        BigDecimal change,
        String reference,
        Instant paidAt,
        Long cashierId
) {
    public static PaymentResponse from(Payment payment) {
        return new PaymentResponse(
                payment.getId(),
                payment.getOrder().getId(),
                payment.getMethod(),
                payment.getAmount(),
                payment.getReceived(),
                payment.getChange(),
                payment.getReference(),
                payment.getPaidAt(),
                payment.getCashier().getId());
    }
}