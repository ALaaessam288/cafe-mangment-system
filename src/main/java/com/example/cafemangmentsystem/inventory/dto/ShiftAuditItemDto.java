package com.example.cafemangmentsystem.inventory.dto;

import com.example.cafemangmentsystem.inventory.entity.ShiftAuditItem;

/**
 * A raw material counted at shift boundaries.
 *
 * <p>{@code costPerUnit} is exposed so a variance can be reported in money as well as in grams.
 * The entity has carried it all along, but the DTO did not, which left the waste report showing
 * "‎−240 جرام‎" — true, but not a number anyone can act on or put in a P&L.
 */
public record ShiftAuditItemDto(
        Long id,
        String name,
        String unit,
        Double stockQuantity,
        Double minThreshold,
        Double costPerUnit,
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
                item.getCostPerUnit(),
                item.isRequiresAudit(),
                item.isActive()
        );
    }
}
