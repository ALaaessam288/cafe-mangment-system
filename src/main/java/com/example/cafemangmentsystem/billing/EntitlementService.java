package com.example.cafemangmentsystem.billing;

import com.example.cafemangmentsystem.billing.dto.AccessLevel;
import com.example.cafemangmentsystem.billing.dto.Entitlements;
import com.example.cafemangmentsystem.billing.entity.*;
import com.example.cafemangmentsystem.billing.repository.TenantSubscriptionRepository;
import com.example.cafemangmentsystem.tenant.entity.Tenant;
import com.example.cafemangmentsystem.tenant.entity.TenantStatus;
import com.example.cafemangmentsystem.tenant.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.EnumMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * The single place that answers "what is this tenant allowed to do?".
 *
 * <p>Access is derived from the subscription's own status <em>and</em> from the clock, so a
 * subscription that lapsed since the scheduler last ran is still treated as lapsed on the very
 * next request. The scheduled job persists that transition; this method never needs to wait for it.
 *
 * <p>Results are cached per tenant because the guard filter, the feature interceptor and the quota
 * service all ask for them on the same request. The cache is explicitly invalidated by
 * {@link SubscriptionService} on every mutation, and entries carry the deadline that would change
 * the answer so a cached entry can never outlive a state transition.
 */
@Service
@RequiredArgsConstructor
public class EntitlementService {

    private final TenantSubscriptionRepository subscriptionRepository;
    private final TenantRepository tenantRepository;
    private final BillingProperties properties;

    private final Map<Long, CacheEntry> cache = new ConcurrentHashMap<>();

    private record CacheEntry(Entitlements entitlements, Instant validUntil) {
        boolean isFresh(Instant now) {
            return validUntil == null || now.isBefore(validUntil);
        }
    }

    @Transactional(readOnly = true)
    public Entitlements forTenant(Long tenantId) {
        if (tenantId == null) return Entitlements.none(null);

        Instant now = Instant.now();
        CacheEntry cached = cache.get(tenantId);
        if (cached != null && cached.isFresh(now)) {
            return cached.entitlements();
        }

        Entitlements resolved = resolve(tenantId, now);
        cache.put(tenantId, new CacheEntry(resolved, nextTransition(resolved, now)));
        return resolved;
    }

    /** Drop a tenant's cached entitlements. Called after any change to its subscription or plan. */
    public void invalidate(Long tenantId) {
        if (tenantId != null) cache.remove(tenantId);
    }

    /** Drop everything — used when a plan itself is edited, which can affect many tenants. */
    public void invalidateAll() {
        cache.clear();
    }

    private Entitlements resolve(Long tenantId, Instant now) {
        Tenant tenant = tenantRepository.findById(tenantId).orElse(null);
        if (tenant == null) {
            // The token names a tenant that no longer exists. Deny writes rather than fall through
            // open, which is what the old filter did when findById returned empty.
            return new Entitlements(tenantId, null, null, null, null, AccessLevel.BLOCKED,
                    Set.of(), Map.of(), null, null, false);
        }

        // A platform suspension outranks anything the subscription says.
        if (tenant.getStatus() == TenantStatus.SUSPENDED) {
            return new Entitlements(tenantId, null, null, null, SubscriptionStatus.SUSPENDED,
                    AccessLevel.BLOCKED, Set.of(), Map.of(), null, null, false);
        }

        Optional<TenantSubscription> found = subscriptionRepository.findByTenantIdAndCurrentTrue(tenantId);
        if (found.isEmpty()) {
            return Entitlements.none(tenantId);
        }
        TenantSubscription subscription = found.get();
        Plan plan = subscription.getPlan();

        SubscriptionStatus effectiveStatus = effectiveStatus(subscription, now);

        Map<QuotaType, Integer> limits = new EnumMap<>(QuotaType.class);
        for (QuotaType type : QuotaType.values()) {
            limits.put(type, subscription.effectiveLimit(type));
        }

        return new Entitlements(
                tenantId,
                subscription.getId(),
                plan.getCode(),
                plan.getDisplayNameAr(),
                effectiveStatus,
                accessLevelFor(effectiveStatus),
                plan.featureSet(),
                Map.copyOf(limits),
                subscription.getCurrentPeriodEnd(),
                graceDeadline(subscription),
                subscription.isPerpetual()
        );
    }

    /**
     * Re-derives the status from the clock. The stored status is a materialised view maintained by
     * {@link SubscriptionExpiryJob}; between runs it can lag, and access decisions must not.
     */
    private SubscriptionStatus effectiveStatus(TenantSubscription subscription, Instant now) {
        SubscriptionStatus stored = subscription.getStatus();
        if (stored == SubscriptionStatus.SUSPENDED || stored == SubscriptionStatus.CANCELLED) {
            return stored;
        }
        Instant periodEnd = subscription.getCurrentPeriodEnd();
        if (periodEnd == null || now.isBefore(periodEnd)) {
            return stored == SubscriptionStatus.GRACE || stored == SubscriptionStatus.EXPIRED
                    ? SubscriptionStatus.ACTIVE
                    : stored;
        }
        Instant graceEnd = graceDeadline(subscription);
        return now.isBefore(graceEnd) ? SubscriptionStatus.GRACE : SubscriptionStatus.EXPIRED;
    }

    Instant graceDeadline(TenantSubscription subscription) {
        Instant periodEnd = subscription.getCurrentPeriodEnd();
        if (periodEnd == null) return null;
        if (subscription.getGraceEndsAt() != null) return subscription.getGraceEndsAt();
        int graceDays = subscription.getGraceDays() != null ? subscription.getGraceDays() : properties.getGraceDays();
        return periodEnd.plus(java.time.Duration.ofDays(Math.max(0, graceDays)));
    }

    private AccessLevel accessLevelFor(SubscriptionStatus status) {
        if (status == SubscriptionStatus.SUSPENDED) return AccessLevel.BLOCKED;
        return status.isWritable() ? AccessLevel.FULL : AccessLevel.READ_ONLY;
    }

    /** The next instant at which this tenant's answer could change on its own. */
    private Instant nextTransition(Entitlements entitlements, Instant now) {
        Instant periodEnd = entitlements.periodEnd();
        Instant graceEnd = entitlements.graceEndsAt();
        Instant soonest = null;
        if (periodEnd != null && periodEnd.isAfter(now)) soonest = periodEnd;
        if (graceEnd != null && graceEnd.isAfter(now) && (soonest == null || graceEnd.isBefore(soonest))) {
            soonest = graceEnd;
        }
        // Never cache longer than a minute regardless, so an admin action elsewhere surfaces quickly
        // even if this node missed the invalidation.
        Instant ceiling = now.plusSeconds(60);
        if (soonest == null || soonest.isAfter(ceiling)) return ceiling;
        return soonest;
    }
}
