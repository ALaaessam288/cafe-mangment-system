package com.example.cafemangmentsystem.order.dto;

import com.example.cafemangmentsystem.payment.entity.PaymentMethod;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CheckoutRequest {
    @NotNull(message = "طريقة الدفع مطلوبة")
    private PaymentMethod method;

    private BigDecimal amount;
    private BigDecimal received;
    private BigDecimal change;
    private String reference;
    private String customerPhone;
    private String note;
    private String idempotencyKey;
}
