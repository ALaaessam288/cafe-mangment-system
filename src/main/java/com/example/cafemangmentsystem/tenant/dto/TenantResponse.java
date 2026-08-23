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
        String currency,
        String subscriptionPlan,
        String planDisplayName,
        java.time.Instant trialEndsAt,
        java.time.Instant subscriptionEndsAt,
        int maxTables,
        int maxUsers,
        int maxProducts,
        boolean includesKds,
        boolean includesExpenses
) {
    public static TenantResponse from(Tenant tenant) {
        var plan = tenant.getSubscriptionPlan() != null ? tenant.getSubscriptionPlan() : com.example.cafemangmentsystem.tenant.entity.SubscriptionPlan.TRIAL;
        int tables = tenant.getMaxTables() != null ? tenant.getMaxTables() : plan.getMaxTables();
        int users = tenant.getMaxUsers() != null ? tenant.getMaxUsers() : plan.getMaxUsers();
        int products = tenant.getMaxProducts() != null ? tenant.getMaxProducts() : plan.getMaxProducts();

        return new TenantResponse(
                tenant.getId(),
                tenant.getName(),
                tenant.getSlug(),
                tenant.getBusinessType(),
                tenant.getStatus(),
                tenant.getTimezone(),
                tenant.getCurrency(),
                plan.name(),
                plan.getDisplayName(),
                tenant.getTrialEndsAt(),
                tenant.getSubscriptionEndsAt(),
                tables,
                users,
                products,
                plan.isIncludesKds(),
                plan.isIncludesExpenses()
        );
    }
}
