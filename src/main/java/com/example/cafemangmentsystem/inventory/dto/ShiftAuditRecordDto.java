package com.example.cafemangmentsystem.inventory.dto;

import com.example.cafemangmentsystem.inventory.entity.ShiftAuditRecord;

import java.time.Instant;

public record ShiftAuditRecordDto(
        Long id,
        Long shiftId,
        Long auditItemId,
        String auditItemName,
        String auditItemUnit,
        Double openingCount,
        Double soldDeductionCount,
        Double expectedClosingCount,
        Double actualClosingCount,
        Double varianceCount,
        Double wastePercentage,
        Instant auditedAt
) {
    public static ShiftAuditRecordDto from(ShiftAuditRecord record) {
        return new ShiftAuditRecordDto(
                record.getId(),
                record.getShift().getId(),
                record.getAuditItem().getId(),
                record.getAuditItem().getName(),
                record.getAuditItem().getUnit(),
                record.getOpeningCount(),
                record.getSoldDeductionCount(),
                record.getExpectedClosingCount(),
                record.getActualClosingCount(),
                record.getVarianceCount(),
                record.getWastePercentage(),
                record.getAuditedAt()
        );
    }
}
