package com.example.cafemangmentsystem.inventory.dto;

import com.example.cafemangmentsystem.inventory.entity.RawMaterialMovement;
import com.example.cafemangmentsystem.inventory.entity.RawMaterialMovementType;

import java.math.BigDecimal;
import java.time.Instant;

/** One row of the raw-material ledger, with the material's name resolved for reading. */
public record RawMaterialMovementDto(
        Long id,
        Long auditItemId,
        String materialName,
        String unit,
        RawMaterialMovementType type,
        String typeLabel,
        Double quantityChange,
        Double resultingQuantity,
        BigDecimal unitCost,
        BigDecimal totalCost,
        String reason,
        String reference,
        Long shiftId,
        String performedBy,
        Instant occurredAt
) {
    public static RawMaterialMovementDto from(RawMaterialMovement m) {
        return new RawMaterialMovementDto(
                m.getId(),
                m.getAuditItem() != null ? m.getAuditItem().getId() : null,
                m.getAuditItem() != null ? m.getAuditItem().getName() : null,
                m.getAuditItem() != null ? m.getAuditItem().getUnit() : null,
                m.getType(),
                m.getType() != null ? m.getType().getDisplayNameAr() : null,
                m.getQuantityChange(),
                m.getResultingQuantity(),
                m.getUnitCost(),
                m.getTotalCost(),
                m.getReason(),
                m.getReference(),
                m.getShiftId(),
                m.getPerformedBy(),
                m.getOccurredAt());
    }
}
