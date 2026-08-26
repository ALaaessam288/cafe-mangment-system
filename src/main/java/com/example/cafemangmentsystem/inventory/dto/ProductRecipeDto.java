package com.example.cafemangmentsystem.inventory.dto;

import com.example.cafemangmentsystem.inventory.entity.ProductRecipe;

public record ProductRecipeDto(
        Long id,
        Long productId,
        Long auditItemId,
        String auditItemName,
        String auditItemUnit,
        Double deductionQuantity
) {
    public static ProductRecipeDto from(ProductRecipe recipe) {
        return new ProductRecipeDto(
                recipe.getId(),
                recipe.getProduct().getId(),
                recipe.getAuditItem().getId(),
                recipe.getAuditItem().getName(),
                recipe.getAuditItem().getUnit(),
                recipe.getDeductionQuantity()
        );
    }
}
