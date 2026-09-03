package com.example.cafemangmentsystem.tenant.platform.dto;

import com.example.cafemangmentsystem.tenant.entity.BusinessType;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Tenant bootstrap payload.
 *
 * <p>{@code planCode} is a plan code rather than an enum constant: plans are rows now, so a new
 * tier can be sold without recompiling the DTO that provisions against it. Null means the platform
 * default trial.
 */
public record ProvisionTenantRequest(
        @NotBlank @Size(min = 2, max = 80) String name,
        @NotBlank @Size(max = 48) @Pattern(regexp = "^[a-z0-9]+(?:-[a-z0-9]+)*$", message = "slug must be lowercase letters, digits and single hyphens between words") String slug,
        @NotNull BusinessType businessType,
        @Size(max = 40) String planCode,
        @Size(max = 24) @Pattern(regexp = "^$|^(?=(?:[^0-9]*[0-9]){10,15}[^0-9]*$)[+0-9 ()-]{10,24}$", message = "ownerWhatsapp has an invalid format") String ownerWhatsapp,
        @NotBlank @Size(min = 3, max = 32) @Pattern(regexp = "^[A-Za-z0-9._-]+$", message = "ownerUsername contains unsupported characters") String ownerUsername,
        @NotBlank @Size(min = 8, max = 128, message = "password must be between 8 and 128 characters")
        @Pattern(regexp = "^(?=.*[A-Za-z])(?=.*\\d).+$", message = "password must contain at least one letter and one number") String ownerPassword,
        @NotBlank @Size(min = 2, max = 80) String ownerFullName,
        @Size(max = 64) String timezone,
        @Pattern(regexp = "^[A-Z]{3}$", message = "currency must be a three-letter uppercase code") String currency,
        @Pattern(regexp = "^$|^(CLASSIC_CAFE|EGYPTIAN_RESTAURANT|CAFE_AND_RESTAURANT)$", message = "unsupported menu template") String templateId,
        @Min(0) @Max(9999) Integer defaultTables
) {
    /** Convenience for callers that don't set a WhatsApp number. */
    public ProvisionTenantRequest(
            String name, String slug, BusinessType businessType, String planCode,
            String ownerUsername, String ownerPassword, String ownerFullName,
            String timezone, String currency, String templateId, Integer defaultTables
    ) {
        this(name, slug, businessType, planCode, null, ownerUsername, ownerPassword, ownerFullName,
                timezone, currency, templateId, defaultTables);
    }

    /** Convenience for the public trial path, which never chooses a plan. */
    public ProvisionTenantRequest(
            String name, String slug, BusinessType businessType,
            String ownerUsername, String ownerPassword, String ownerFullName,
            String timezone, String currency, String templateId, Integer defaultTables
    ) {
        this(name, slug, businessType, null, null, ownerUsername, ownerPassword, ownerFullName,
                timezone, currency, templateId, defaultTables);
    }

    public ProvisionTenantRequest withPlanCode(String newPlanCode) {
        return new ProvisionTenantRequest(name, slug, businessType, newPlanCode, ownerWhatsapp,
                ownerUsername, ownerPassword, ownerFullName, timezone, currency, templateId, defaultTables);
    }
}
