package com.example.cafemangmentsystem.menu.dto;

import com.example.cafemangmentsystem.menu.entity.Product;
import com.example.cafemangmentsystem.menu.entity.RevenueLine;
import com.example.cafemangmentsystem.station.entity.StationCode;

import java.math.BigDecimal;

public record ProductResponse(
        Long id,
        Long categoryId,
        String categoryNameAr,
        Long stationId,
        StationCode stationCode,
        RevenueLine revenueLine,
        String nameAr,
        String nameEn,
        BigDecimal price,
        boolean available,
        boolean active,
        String prepNote,
        Integer stockQuantity,
        Integer reservedQuantity,
        Integer availableQuantity,
        Boolean trackInventory,
        Boolean recipeInventory,
        Integer minStockThreshold,
        Long primaryIngredientId,
        String primaryIngredientName,
        String primaryIngredientUnit,
        Double primaryIngredientStock,
        Double deductionQuantity
) {
    public static ProductResponse from(Product product) {
        return from(product, null, null);
    }

    public static ProductResponse from(Product product, Integer recipeAvailableQuantity) {
        return from(product, recipeAvailableQuantity, null);
    }

    public static ProductResponse from(
            Product product,
            Integer recipeAvailableQuantity,
            com.example.cafemangmentsystem.inventory.ShiftAuditService.PrimaryIngredientInfo ingredientInfo) {
        int directAvailable = Math.max(0, product.getStockQuantity() - product.getReservedQuantity());
        int effectiveAvailable = recipeAvailableQuantity == null
                ? directAvailable
                : (product.isTrackInventory()
                    ? Math.min(directAvailable, recipeAvailableQuantity)
                    : recipeAvailableQuantity);
        return new ProductResponse(
                product.getId(),
                product.getCategory() != null ? product.getCategory().getId() : null,
                product.getCategory() != null ? product.getCategory().getNameAr() : null,
                product.getStation() != null ? product.getStation().getId() : null,
                product.getStation() != null ? product.getStation().getCode() : null,
                product.getRevenueLine(),
                product.getNameAr(),
                product.getNameEn(),
                product.getPrice(),
                product.isAvailable(),
                product.isActive(),
                product.getPrepNote(),
                product.getStockQuantity(),
                product.getReservedQuantity(),
                // What's actually left to sell right now, accounting for items already sitting
                // in someone's cart. Only meaningful for tracked products; untracked ones never
                // touch stock_quantity/reserved_quantity at all so this just mirrors stockQuantity.
                effectiveAvailable,
                product.isTrackInventory(),
                recipeAvailableQuantity != null,
                product.getMinStockThreshold(),
                ingredientInfo != null ? ingredientInfo.id() : null,
                ingredientInfo != null ? ingredientInfo.name() : null,
                ingredientInfo != null ? ingredientInfo.unit() : null,
                ingredientInfo != null ? ingredientInfo.stockQuantity() : null,
                ingredientInfo != null ? ingredientInfo.deductionQuantity() : null
        );
    }
}
