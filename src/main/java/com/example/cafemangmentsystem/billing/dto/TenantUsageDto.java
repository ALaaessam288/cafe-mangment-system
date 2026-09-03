package com.example.cafemangmentsystem.billing.dto;

import com.example.cafemangmentsystem.billing.entity.QuotaType;
import com.example.cafemangmentsystem.billing.entity.SubscriptionStatus;

import java.util.List;

/**
 * Everything a client needs to render the subscription state: what the tenant has used, what it is
 * allowed, how long it has left, and whether it should be warning the user.
 *
 * <p>The super-admin's usage endpoint previously returned only three ceiling numbers and no counts
 * at all, while the tenant's own endpoint returned a different, richer, untyped {@code Map}. Both
 * now return this.
 */
public record TenantUsageDto(
        Long tenantId,
        String tenantName,
        String tenantSlug,
        String planCode,
        String planName,
        SubscriptionStatus status,
        AccessLevel accessLevel,
        List<QuotaUsage> quotas,
        List<PlanDto.FeatureDto> features,
        Long daysRemaining,
        boolean perpetual,
        boolean inGrace,
        java.time.Instant periodEnd,
        java.time.Instant graceEndsAt
) {
    /** Used versus allowed for one resource. {@code limit == -1} means unlimited. */
    public record QuotaUsage(String type, String displayName, long used, int limit,
                             boolean unlimited, Integer remaining, boolean exceeded) {
        public static QuotaUsage of(QuotaType type, long used, int limit) {
            boolean unlimited = QuotaType.isUnlimited(limit);
            return new QuotaUsage(
                    type.name(),
                    type.getDisplayNameAr(),
                    used,
                    limit,
                    unlimited,
                    unlimited ? null : (int) Math.max(0, limit - used),
                    !unlimited && used >= limit
            );
        }
    }
}
