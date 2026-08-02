package com.example.cafemangmentsystem.menu.dto;

import com.example.cafemangmentsystem.menu.entity.ProductOption;

import java.math.BigDecimal;

public record ProductOptionResponse(
        Long id,
        Long productId,
        String nameAr,
        BigDecimal priceDelta,
        boolean isDefault
) {
    public static ProductOptionResponse from(ProductOption option) {
        return new ProductOptionResponse(option.getId(), option.getProduct().getId(),
                option.getNameAr(), option.getPriceDelta(), option.isDefault());
    }
}