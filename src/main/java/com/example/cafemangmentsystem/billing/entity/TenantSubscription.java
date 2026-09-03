package com.example.cafemangmentsystem.billing.entity;

import com.example.cafemangmentsystem.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * One tenant's subscription. Platform-level with a plain {@code tenant_id} column (same pattern as
 * {@code TenantActivityLog}) so the super-admin can read it without a tenant context.
 *
 * <p>At most one row per tenant is {@code current}; superseded rows are kept as the tenant's
 * subscription history, which is what makes churn, upgrade and renewal reporting possible — the
 * old model had a single mutable {@code subscriptionEndsAt} column on the tenant and therefore no
 * history at all.
 *
 * <p>Per-tenant quota overrides live here rather than on the tenant, so switching plan naturally
 * discards a bespoke deal instead of silently keeping stale numbers (or silently wiping them,
 * which the two old admin endpoints did inconsistently).
 */
@Entity
@Table(name = "tenant_subscriptions", indexes = {
        @Index(name = "idx_tenant_subscriptions_tenant", columnList = "tenant_id"),
        @Index(name = "idx_tenant_subscriptions_current", columnList = "tenant_id, current_subscription"),
        @Index(name = "idx_tenant_subscriptions_period_end", columnList = "current_period_end")
})
@Getter
@Setter
@NoArgsConstructor
public class TenantSubscription extends BaseEntity {

    @Column(name = "tenant_id", nullable = false)
    private Long tenantId;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "plan_id", nullable = false)
    private Plan plan;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private SubscriptionStatus status = SubscriptionStatus.TRIALING;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private SubscriptionSource source = SubscriptionSource.TRIAL_SIGNUP;

    /** Exactly one row per tenant carries true. */
    @Column(name = "current_subscription", nullable = false)
    private boolean current = true;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "current_period_start", nullable = false)
    private Instant currentPeriodStart;

    /** Null means perpetual (a lifetime licence). */
    @Column(name = "current_period_end")
    private Instant currentPeriodEnd;

    /** Set when the period lapses; writes stay open until this passes. */
    @Column(name = "grace_ends_at")
    private Instant graceEndsAt;

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    @Column(name = "cancel_reason", length = 500)
    private String cancelReason;

    /** What this tenant actually agreed to pay, frozen at purchase. */
    @Column(name = "price_at_purchase", nullable = false, precision = 12, scale = 2)
    private BigDecimal priceAtPurchase = BigDecimal.ZERO;

    @Column(nullable = false, length = 8)
    private String currency = "EGP";

    @Column(name = "auto_renew", nullable = false)
    private boolean autoRenew = false;

    @Column(name = "license_key_id")
    private Long licenseKeyId;

    // ── Per-tenant overrides. Null = inherit the plan's limit. ───────────────
    @Column(name = "override_max_tables")
    private Integer overrideMaxTables;

    @Column(name = "override_max_users")
    private Integer overrideMaxUsers;

    @Column(name = "override_max_products")
    private Integer overrideMaxProducts;

    /** Days of write access after the period ends. Null = platform default. */
    @Column(name = "grace_days")
    private Integer graceDays;

    @Column(length = 500)
    private String notes;

    /** Highest expiry-warning threshold already sent, so the job doesn't spam the owner. */
    @Column(name = "last_warning_days")
    private Integer lastWarningDays;

    public int effectiveLimit(QuotaType type) {
        Integer override = switch (type) {
            case TABLES -> overrideMaxTables;
            case USERS -> overrideMaxUsers;
            case PRODUCTS -> overrideMaxProducts;
        };
        return override != null ? override : plan.limitFor(type);
    }

    public boolean isPerpetual() {
        return currentPeriodEnd == null;
    }

    /** The instant after which writes stop: end of period, extended by grace when one is set. */
    public Instant writeAccessEndsAt() {
        if (currentPeriodEnd == null) return null;
        return graceEndsAt != null && graceEndsAt.isAfter(currentPeriodEnd) ? graceEndsAt : currentPeriodEnd;
    }
}
