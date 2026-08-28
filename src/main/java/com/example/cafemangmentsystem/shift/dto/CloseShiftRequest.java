package com.example.cafemangmentsystem.shift.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.math.BigDecimal;

public record CloseShiftRequest(
        @NotNull(message = "المبلغ النقدي الفعلي بالدرج مطلوب")
        @PositiveOrZero(message = "يجب ألا يكون المبلغ النقدي سالباً")
        BigDecimal countedCash,

        BigDecimal snacksNet,

        String notes
) {
}
