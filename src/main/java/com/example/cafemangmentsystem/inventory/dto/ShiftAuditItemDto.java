package com.example.cafemangmentsystem.inventory.dto;

import com.example.cafemangmentsystem.inventory.entity.ShiftAuditItem;

public record ShiftAuditItemDto(
        Long id,
        String name,
        String unit,
        Double stockQuantity,
        Double minThreshold,
        boolean requiresAudit,
        boolean active
) {
    public static ShiftAuditItemDto from(ShiftAuditItem item) {
        return new ShiftAuditItemDto(
                item.getId(),
                item.getName(),
                item.getUnit(),
                item.getStockQuantity(),
                item.getMinThreshold(),
                item.isRequiresAudit(),
                item.isActive()
        );
    }
}
