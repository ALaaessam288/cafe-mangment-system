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
        String prepNote
) {
    public static ProductResponse from(Product product) {
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
                product.getPrepNote());
    }
}