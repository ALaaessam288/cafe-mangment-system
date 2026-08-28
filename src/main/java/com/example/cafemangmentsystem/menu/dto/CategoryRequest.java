package com.example.cafemangmentsystem.menu.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record CategoryRequest(
        @NotBlank(message = "اسم القسم مطلوب")
        String nameAr,

        String nameEn,

        @NotNull(message = "ترتيب العرض مطلوب")
        @PositiveOrZero(message = "يجب أن يكون ترتيب العرض رقماً موجباً أو صفراً")
        Integer displayOrder
) {
}
