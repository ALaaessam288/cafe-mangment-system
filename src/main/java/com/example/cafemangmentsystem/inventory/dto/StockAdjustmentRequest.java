package com.example.cafemangmentsystem.inventory.dto;

import com.example.cafemangmentsystem.inventory.entity.StockAdjustmentType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record StockAdjustmentRequest(
        @NotNull(message = "نوع التعديل مطلوب")
        StockAdjustmentType type,

        @NotNull(message = "كمية التعديل مطلوبة")
        Integer quantityChange,

        @NotBlank(message = "سبب تعديل المخزون مطلوب")
        String reason
) {
}
