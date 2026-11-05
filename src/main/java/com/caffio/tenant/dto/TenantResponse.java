package com.caffio.tenant.dto;

import com.caffio.billing.entity.QuotaType;
import com.caffio.billing.entity.SubscriptionStatus;
import com.caffio.billing.entity.TenantSubscription;
import com.caffio.tenant.entity.BusinessType;
import com.caffio.tenant.entity.Tenant;
import com.caffio.tenant.entity.TenantStatus;

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
        Integer maxProducts,
        Long defaultWaterProductId
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
                subscription != null ? subscription.effectiveLimit(QuotaType.PRODUCTS) : null,
                tenant.getDefaultWaterProductId()
        );
    }
}
