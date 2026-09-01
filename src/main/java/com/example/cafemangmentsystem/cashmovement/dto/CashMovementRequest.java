package com.example.cafemangmentsystem.cashmovement.dto;

import com.example.cafemangmentsystem.cashmovement.entity.CashMovementType;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record CashMovementRequest(
        @NotNull(message = "نوع الحركة مطلوب")
        CashMovementType type,

        @NotNull(message = "المبلغ مطلوب")
        @DecimalMin(value = "0.01", message = "المبلغ يجب أن يكون أكبر من صفر")
        BigDecimal amount,

        String reason,
        Long shiftId,
        Long registerId
) {}
