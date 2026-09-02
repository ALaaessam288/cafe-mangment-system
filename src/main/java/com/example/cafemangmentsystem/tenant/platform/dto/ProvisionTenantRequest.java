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
        com.example.cafemangmentsystem.tenant.entity.SubscriptionPlan subscriptionPlan,
        String ownerWhatsapp,
        @NotBlank String ownerUsername,
        @NotBlank @Size(min = 8, message = "password must be at least 8 characters") String ownerPassword,
        @NotBlank String ownerFullName,
        String timezone,
        String currency,
        String templateId,
        Integer defaultTables
) {
    public ProvisionTenantRequest(
            String name, String slug, BusinessType businessType,
            com.example.cafemangmentsystem.tenant.entity.SubscriptionPlan subscriptionPlan,
            String ownerUsername, String ownerPassword, String ownerFullName,
            String timezone, String currency, String templateId, Integer defaultTables
    ) {
        this(name, slug, businessType, subscriptionPlan, null, ownerUsername, ownerPassword, ownerFullName, timezone, currency, templateId, defaultTables);
    }

    public ProvisionTenantRequest(
            String name, String slug, BusinessType businessType,
            String ownerUsername, String ownerPassword, String ownerFullName,
            String timezone, String currency, String templateId, Integer defaultTables
    ) {
        this(name, slug, businessType, com.example.cafemangmentsystem.tenant.entity.SubscriptionPlan.TRIAL, null,
                ownerUsername, ownerPassword, ownerFullName, timezone, currency, templateId, defaultTables);
    }
}
