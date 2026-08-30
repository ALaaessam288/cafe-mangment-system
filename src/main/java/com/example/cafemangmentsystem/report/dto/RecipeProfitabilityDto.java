package com.example.cafemangmentsystem.report.dto;

import java.util.List;

public record RecipeProfitabilityDto(
        List<RawMaterialProfitSummary> rawMaterials,
        List<RecipeProductProfitItem> recipes,
        Double totalRecipeRevenue,
        Double totalRecipeCost,
        Double totalRecipeGrossProfit,
        Double averageProfitMarginPercent
) {
    public record RawMaterialProfitSummary(
            Long id,
            String name,
            String unit,
            Double currentStock,
            Double costPerUnit,
            Double costPer1000Units,
            Double costPer250Units,
            List<RecipeProductProfitItem> products,
            Double totalConsumedQuantity,
            Double totalGeneratedRevenue,
            Double totalRealizedCost,
            Double totalRealizedProfit
    ) {}

    public record RecipeProductProfitItem(
            Long productId,
            String productName,
            String categoryName,
            Double sellingPrice,
            Long rawMaterialId,
            String rawMaterialName,
            String rawMaterialUnit,
            Double deductionQuantity,
            Double yieldPer250Units,
            Double yieldPer1000Units,
            Double revenuePer250Units,
            Double revenuePer1000Units,
            Double costPerUnitSold,
            Double profitPerUnitSold,
            Double profitMarginPercent,
            Integer actualQuantitySold,
            Double actualRevenue,
            Double actualCost,
            Double actualProfit
    ) {}
}
