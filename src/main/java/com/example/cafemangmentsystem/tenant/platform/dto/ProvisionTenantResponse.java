package com.example.cafemangmentsystem.tenant.platform.dto;

public record ProvisionTenantResponse(
        Long tenantId,
        String slug,
        String ownerUsername
) {
}
