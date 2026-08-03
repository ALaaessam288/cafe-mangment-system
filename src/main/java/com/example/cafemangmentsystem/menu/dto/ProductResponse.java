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
                product.getCategory().getId(),
                product.getCategory().getNameAr(),
                product.getStation().getId(),
                product.getStation().getCode(),
                product.getRevenueLine(),
                product.getNameAr(),
                product.getNameEn(),
                product.getPrice(),
                product.isAvailable(),
                product.isActive(),
                product.getPrepNote());
    }
}