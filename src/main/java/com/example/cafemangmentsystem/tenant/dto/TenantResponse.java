package com.example.cafemangmentsystem.tenant.dto;

import com.example.cafemangmentsystem.tenant.entity.BusinessType;
import com.example.cafemangmentsystem.tenant.entity.Tenant;
import com.example.cafemangmentsystem.tenant.entity.TenantStatus;

public record TenantResponse(
        Long id,
        String name,
        String slug,
        BusinessType businessType,
        TenantStatus status,
        String timezone,
        String currency
) {
    public static TenantResponse from(Tenant tenant) {
        return new TenantResponse(tenant.getId(), tenant.getName(), tenant.getSlug(),
                tenant.getBusinessType(), tenant.getStatus(), tenant.getTimezone(), tenant.getCurrency());
    }
}
