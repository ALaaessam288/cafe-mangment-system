package com.example.cafemangmentsystem.manageroverride.dto;

import com.example.cafemangmentsystem.manageroverride.entity.ManagerOverride;
import com.example.cafemangmentsystem.manageroverride.entity.ManagerOverrideType;

import java.math.BigDecimal;
import java.time.Instant;

public record ManagerOverrideResponse(
        Long id,
        Long supervisorId,
        String supervisorName,
        String supervisorRole,
        Long cashierId,
        String cashierName,
        ManagerOverrideType actionType,
        Long orderId,
        Long shiftId,
        BigDecimal amount,
        String reason,
        String details,
        Instant performedAt,
        boolean authorized
) {
    public static ManagerOverrideResponse from(ManagerOverride o) {
        return new ManagerOverrideResponse(
                o.getId(),
                o.getSupervisor() != null ? o.getSupervisor().getId() : null,
                o.getSupervisor() != null ? o.getSupervisor().getFullName() : null,
                o.getSupervisor() != null && o.getSupervisor().getRole() != null ? o.getSupervisor().getRole().name() : null,
                o.getCashier() != null ? o.getCashier().getId() : null,
                o.getCashier() != null ? o.getCashier().getFullName() : null,
                o.getActionType(),
                o.getOrderId(),
                o.getShiftId(),
                o.getAmount(),
                o.getReason(),
                o.getDetails(),
                o.getPerformedAt(),
                true
        );
    }
}
