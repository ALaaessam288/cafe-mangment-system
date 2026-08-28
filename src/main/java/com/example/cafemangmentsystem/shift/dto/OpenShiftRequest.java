package com.example.cafemangmentsystem.shift.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.math.BigDecimal;

public record OpenShiftRequest(
        @NotNull(message = "معرف الخزينة مطلوب")
        Long registerId,

        @NotNull(message = "مبلغ العهدة الافتتاحية مطلوب")
        @PositiveOrZero(message = "يجب ألا يكون مبلغ العهدة سالباً")
        BigDecimal openingFloat
) {
}
