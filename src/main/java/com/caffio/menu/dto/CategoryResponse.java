package com.caffio.menu.dto;

import com.caffio.menu.entity.Category;

public record CategoryResponse(
        Long id,
        String nameAr,
        String nameEn,
        Integer displayOrder,
        boolean active
) {
    public static CategoryResponse from(Category category) {
        return new CategoryResponse(category.getId(), category.getNameAr(), category.getNameEn(),
                category.getDisplayOrder(), category.isActive());
    }
}