package com.example.cafemangmentsystem.tenant.dto;

import com.example.cafemangmentsystem.billing.entity.QuotaType;
import com.example.cafemangmentsystem.billing.entity.SubscriptionStatus;
import com.example.cafemangmentsystem.billing.entity.TenantSubscription;
import com.example.cafemangmentsystem.tenant.entity.BusinessType;
import com.example.cafemangmentsystem.tenant.entity.Tenant;
import com.example.cafemangmentsystem.tenant.entity.TenantStatus;

import java.time.Instant;

/**
 * A tenant plus a summary of whatever subscription it currently holds.
 *
 * <p>The subscription half is nullable on purpose — a tenant mid-provisioning genuinely has none,
 * and the previous version papered over that by defaulting to TRIAL, which made a broken tenant
 * indistinguishable from a trialling one.
 */
public record TenantResponse(
        Long id,
        Instant createdAt,
        String name,
        String slug,
        BusinessType businessType,
        TenantStatus status,
        String timezone,
        String currency,
        Integer serviceChargePercent,
        String ownerWhatsapp,
        boolean whatsappAlertsEnabled,
        String logoUrl,
        boolean planSelected,
        String subscriptionPlan,
        String planDisplayName,
        SubscriptionStatus subscriptionStatus,
        Instant periodEnd,
        Instant graceEndsAt,
        boolean perpetual,
        Integer maxTables,
        Integer maxUsers,
        Integer maxProducts
) {
    public static TenantResponse from(Tenant tenant, TenantSubscription subscription) {
        return new TenantResponse(
                tenant.getId(),
                tenant.getCreatedAt(),
                tenant.getName(),
                tenant.getSlug(),
                tenant.getBusinessType(),
                tenant.getStatus(),
                tenant.getTimezone(),
                tenant.getCurrency(),
                tenant.getServiceChargePercent(),
                tenant.getOwnerWhatsapp(),
                Boolean.TRUE.equals(tenant.getWhatsappAlertsEnabled()),
                tenant.getLogoUrl(),
                Boolean.TRUE.equals(tenant.getPlanSelected()),
                subscription != null ? subscription.getPlan().getCode() : null,
                subscription != null ? subscription.getPlan().getDisplayNameAr() : null,
                subscription != null ? subscription.getStatus() : null,
                subscription != null ? subscription.getCurrentPeriodEnd() : null,
                subscription != null ? subscription.getGraceEndsAt() : null,
                subscription != null && subscription.isPerpetual(),
                subscription != null ? subscription.effectiveLimit(QuotaType.TABLES) : null,
                subscription != null ? subscription.effectiveLimit(QuotaType.USERS) : null,
                subscription != null ? subscription.effectiveLimit(QuotaType.PRODUCTS) : null
        );
    }
}
