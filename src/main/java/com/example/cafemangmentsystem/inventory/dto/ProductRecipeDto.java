package com.example.cafemangmentsystem.inventory.dto;

import com.example.cafemangmentsystem.inventory.entity.ProductRecipe;

public record ProductRecipeDto(
        Long id,
        Long productId,
        String productName,
        Long auditItemId,
        String auditItemName,
        String auditItemUnit,
        Double deductionQuantity
) {
    public static ProductRecipeDto from(ProductRecipe recipe) {
        return new ProductRecipeDto(
                recipe.getId(),
                recipe.getProduct() != null ? recipe.getProduct().getId() : null,
                recipe.getProduct() != null ? recipe.getProduct().getNameAr() : null,
                recipe.getAuditItem() != null ? recipe.getAuditItem().getId() : null,
                recipe.getAuditItem() != null ? recipe.getAuditItem().getName() : null,
                recipe.getAuditItem() != null ? recipe.getAuditItem().getUnit() : null,
                recipe.getDeductionQuantity()
        );
    }
}
