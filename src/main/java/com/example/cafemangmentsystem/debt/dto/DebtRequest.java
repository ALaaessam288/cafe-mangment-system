package com.example.cafemangmentsystem.debt.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.LocalDate;

public record DebtRequest(
        @NotBlank(message = "اسم العميل أو الدائن مطلوب")
        String creditorName,

        @NotNull(message = "مبلغ المديونية مطلوب")
        @Positive(message = "يجب أن يكون المبلغ أكبر من صفر")
        BigDecimal amount,

        String notes,
        LocalDate debtDate,
        LocalDate dueDate
) {
}
