package com.example.cafemangmentsystem.debt.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;

public record SettleDebtRequest(
        Boolean paidFromDrawer,

        @NotNull(message = "مبلغ السداد مطلوب")
        @Positive(message = "يجب أن يكون مبلغ السداد أكبر من صفر")
        BigDecimal amount,

        String notes
) {
}
