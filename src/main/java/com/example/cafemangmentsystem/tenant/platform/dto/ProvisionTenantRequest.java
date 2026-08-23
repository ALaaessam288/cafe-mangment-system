package com.example.cafemangmentsystem.tenant.platform.dto;

import com.example.cafemangmentsystem.tenant.entity.BusinessType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ProvisionTenantRequest(
        @NotBlank String name,
        @NotBlank @Pattern(regexp = "^[a-z0-9-]+$", message = "slug must be lowercase letters, digits and hyphens only") String slug,
        @NotNull BusinessType businessType,
        @NotBlank String ownerUsername,
        @NotBlank @Size(min = 8, message = "password must be at least 8 characters") String ownerPassword,
        @NotBlank String ownerFullName,
        String timezone,
        String currency,
        String templateId,
        Integer defaultTables
) {
}
