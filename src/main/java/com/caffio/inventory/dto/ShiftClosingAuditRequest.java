package com.caffio.inventory.dto;

import java.util.Map;

public record ShiftClosingAuditRequest(
        Map<Long, Double> closingCounts // auditItemId -> actualClosingCount
) {
}
