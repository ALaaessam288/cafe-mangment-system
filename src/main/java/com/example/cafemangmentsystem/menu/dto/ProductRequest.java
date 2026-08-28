package com.example.cafemangmentsystem.menu.dto;

import com.example.cafemangmentsystem.menu.entity.RevenueLine;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

public record ProductRequest(
        @NotNull(message = "القسم مطلوب")
        Long categoryId,

        @NotNull(message = "محطة التحضير مطلوبة")
        Long stationId,

        @NotNull(message = "نوع الإيراد مطلوب")
        RevenueLine revenueLine,

        @NotBlank(message = "اسم الصنف مطلوب")
        String nameAr,

        String nameEn,

        @NotNull(message = "سعر الصنف مطلوب")
        @Positive(message = "يجب أن يكون السعر أكبر من صفر")
        BigDecimal price,

        String prepNote,
        Boolean trackInventory,
        Integer minStockThreshold
) {
}
