package com.example.cafemangmentsystem.menu.dto;

import com.example.cafemangmentsystem.menu.entity.RevenueLine;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

public record ProductRequest(
        @NotNull Long categoryId,
        @NotNull Long stationId,
        @NotNull RevenueLine revenueLine,
        @NotBlank String nameAr,
        String nameEn,
        @NotNull @Positive BigDecimal price,
        String prepNote,
        Boolean trackInventory,
        Integer minStockThreshold
) {
}