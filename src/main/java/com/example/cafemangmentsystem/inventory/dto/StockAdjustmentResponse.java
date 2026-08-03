package com.example.cafemangmentsystem.inventory.dto;

import com.example.cafemangmentsystem.inventory.entity.StockAdjustment;
import com.example.cafemangmentsystem.inventory.entity.StockAdjustmentType;

import java.time.Instant;

public record StockAdjustmentResponse(
        Long id,
        Long productId,
        String productNameAr,
        StockAdjustmentType type,
        int quantityChange,
        int resultingQuantity,
        String reason,
        Long adjustedByUserId,
        Instant adjustedAt
) {
    public static StockAdjustmentResponse from(StockAdjustment adjustment) {
        return new StockAdjustmentResponse(
                adjustment.getId(),
                adjustment.getProduct().getId(),
                adjustment.getProduct().getNameAr(),
                adjustment.getType(),
                adjustment.getQuantityChange(),
                adjustment.getResultingQuantity(),
                adjustment.getReason(),
                adjustment.getAdjustedBy().getId(),
                adjustment.getAdjustedAt());
    }
}