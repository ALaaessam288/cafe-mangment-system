package com.example.cafemangmentsystem.billing.dto;

import com.example.cafemangmentsystem.billing.entity.Feature;
import com.example.cafemangmentsystem.billing.entity.QuotaType;
import com.example.cafemangmentsystem.billing.entity.SubscriptionStatus;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Set;

/**
 * An immutable snapshot of everything one tenant is entitled to. Resolved once per request and
 * consulted by the guard filter, the feature interceptor and the quota service, so those three
 * can never disagree about a tenant's state — which is exactly how a TRIAL tenant used to end up
 * with KDS access the plan said it did not have.
 *
 * @param limits effective ceiling per resource, already merged with any per-tenant override.
 *               {@link QuotaType#UNLIMITED} (-1) means no ceiling.
 */
public record Entitlements(
        Long tenantId,
        Long subscriptionId,
        String planCode,
        String planName,
        SubscriptionStatus status,
        AccessLevel accessLevel,
        Set<Feature> features,
        Map<QuotaType, Integer> limits,
        Instant periodEnd,
        Instant graceEndsAt,
        boolean perpetual
) {

    /** Fallback for a request with no resolvable subscription: readable, but nothing is granted. */
    public static Entitlements none(Long tenantId) {
        return new Entitlements(tenantId, null, null, null, null, AccessLevel.READ_ONLY,
                Set.of(), Map.of(), null, null, false);
    }

    /**
     * The platform tenant itself. It sells subscriptions rather than holding one, so it is granted
     * full access with no plan and no limits — as opposed to the old super-admin login, which
     * answered with a fabricated ENTERPRISE plan and 9999 of everything.
     */
    public static Entitlements platform() {
        return new Entitlements(null, null, "PLATFORM", "Caffio Platform Master", SubscriptionStatus.ACTIVE,
                AccessLevel.FULL, java.util.EnumSet.allOf(Feature.class),
                Map.of(QuotaType.TABLES, QuotaType.UNLIMITED,
                       QuotaType.USERS, QuotaType.UNLIMITED,
                       QuotaType.PRODUCTS, QuotaType.UNLIMITED),
                null, null, true);
    }

    public boolean has(Feature feature) {
        return features.contains(feature);
    }

    public int limit(QuotaType type) {
        return limits.getOrDefault(type, 0);
    }

    public boolean canWrite() {
        return accessLevel == AccessLevel.FULL;
    }

    public boolean canRead() {
        return accessLevel != AccessLevel.BLOCKED;
    }

    /**
     * Whole days left on what the customer is currently living in. Null when perpetual.
     *
     * <p>Counts to the end of the paid period, not to the end of the grace window — grace is a
     * safety net, not part of what was sold. Adding it made a fresh 14-day trial report 18 days
     * remaining, which is both wrong and a promise the account will not keep. Once the period has
     * actually lapsed and the subscription is in GRACE, the countdown becomes the grace deadline,
     * because that is then the real date the writes stop.
     */
    public Long daysRemaining() {
        Instant deadline = status == SubscriptionStatus.GRACE && graceEndsAt != null ? graceEndsAt : periodEnd;
        if (deadline == null) return null;
        long days = Duration.between(Instant.now(), deadline).toDays();
        return Math.max(0, days);
    }

    public boolean inGrace() {
        return status == SubscriptionStatus.GRACE;
    }
}
