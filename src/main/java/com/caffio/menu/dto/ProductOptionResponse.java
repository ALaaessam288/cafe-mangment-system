package com.caffio.menu.dto;

import com.caffio.menu.entity.ProductOption;

import java.math.BigDecimal;

public record ProductOptionResponse(
        Long id,
        Long productId,
        String nameAr,
        BigDecimal priceDelta,
        boolean isDefault,
        String optionGroup
) {
    public static ProductOptionResponse from(ProductOption option) {
        return new ProductOptionResponse(option.getId(), option.getProduct().getId(),
                option.getNameAr(), option.getPriceDelta(), option.isDefault(),
                option.getOptionGroup());
    }
}