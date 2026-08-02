package com.example.cafemangmentsystem.menu.dto;

import com.example.cafemangmentsystem.menu.entity.Category;

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