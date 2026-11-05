package com.caffio.discount.dto;

import com.caffio.discount.entity.Discount;
import com.caffio.discount.entity.DiscountScope;
import com.caffio.discount.entity.DiscountType;

import java.math.BigDecimal;
import java.time.Instant;

public record DiscountResponse(
        Long id,
        Long orderId,
        Long orderItemId,
        DiscountType type,
        DiscountScope scope,
        BigDecimal value,
        BigDecimal maxValue,
        String reason,
        BigDecimal amount,
        Long appliedByUserId,
        Instant appliedAt
) {
    public static DiscountResponse from(Discount discount) {
        return new DiscountResponse(
                discount.getId(),
                discount.getOrder().getId(),
                discount.getItem() == null ? null : discount.getItem().getId(),
                discount.getType(),
                discount.getScope(),
                discount.getValue(),
                discount.getMaxValue(),
                discount.getReason(),
                discount.getAmount(),
                discount.getAppliedBy().getId(),
                discount.getAppliedAt());
    }
}