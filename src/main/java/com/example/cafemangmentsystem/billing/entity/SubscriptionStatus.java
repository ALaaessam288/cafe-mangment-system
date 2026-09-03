package com.example.cafemangmentsystem.billing.entity;

/**
 * The billing state machine. This is the source of truth for access decisions; the legacy
 * {@code TenantStatus} on the tenant row is kept in sync for older readers.
 *
 * <pre>
 *   TRIALING ──expiry──▶ GRACE ──grace over──▶ EXPIRED ──payment──▶ ACTIVE
 *       │                  │                      │
 *       └──licence/pay────▶ ACTIVE ──expiry──────▶ GRACE
 *                            │
 *                            ├──admin──▶ SUSPENDED (hard stop, even reads)
 *                            └──admin/customer──▶ CANCELLED (terminal)
 * </pre>
 */
public enum SubscriptionStatus {
    /** Inside the free trial window. Full write access. */
    TRIALING(true, false),
    /** Paid and inside the current billing period. Full write access. */
    ACTIVE(true, false),
    /**
     * Period ended but inside the configured grace window. Still writable — a café must never be
     * locked out of checkout mid-shift because an invoice lapsed overnight — but every response
     * carries a warning the frontend surfaces as a banner.
     */
    GRACE(true, true),
    /** Grace exhausted. Reads still work so the owner can see their data and pay; writes blocked. */
    EXPIRED(false, true),
    /** Switched off by the platform. Nothing works, including reads. */
    SUSPENDED(false, true),
    /** Terminal. Customer left. Reads allowed for an export window; writes blocked. */
    CANCELLED(false, true);

    private final boolean writable;
    private final boolean warning;

    SubscriptionStatus(boolean writable, boolean warning) {
        this.writable = writable;
        this.warning = warning;
    }

    /** Whether non-GET requests are permitted. */
    public boolean isWritable() { return writable; }

    /** Whether the client should show a subscription warning. */
    public boolean isWarning() { return warning; }

    public boolean isLive() { return this == TRIALING || this == ACTIVE || this == GRACE; }
}
