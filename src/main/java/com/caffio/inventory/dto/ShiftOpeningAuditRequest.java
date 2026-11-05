package com.caffio.inventory.dto;

import java.util.Map;

public record ShiftOpeningAuditRequest(
        Map<Long, Double> openingCounts // auditItemId -> openingCount
) {
}
