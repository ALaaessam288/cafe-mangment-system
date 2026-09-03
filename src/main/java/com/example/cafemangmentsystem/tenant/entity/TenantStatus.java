package com.example.cafemangmentsystem.tenant.entity;

/**
 * The tenant's administrative state, kept in step with the billing state machine on
 * {@code TenantSubscription} (which is the source of truth for access decisions).
 *
 * <p>GRACE and EXPIRED were added because the old set had nowhere to record a lapsed account: a
 * tenant whose subscription ran out months ago still read as ACTIVE, so every platform statistic
 * counted it as a paying customer. CANCELLED existed but was never assigned by any code path.
 */
public enum TenantStatus {
    /** Inside the free trial. */
    TRIAL,
    /** Paying and current. */
    ACTIVE,
    /** Period lapsed, still writable inside the grace window. */
    GRACE,
    /** Grace exhausted — read-only until renewed. */
    EXPIRED,
    /** Switched off by the platform. Cannot log in. */
    SUSPENDED,
    /** Customer left. Terminal. */
    CANCELLED
}
