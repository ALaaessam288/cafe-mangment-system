package com.example.cafemangmentsystem.tenant.entity;

/**
 * @deprecated Replaced by {@link com.example.cafemangmentsystem.billing.entity.Plan}, a database
 * row. Compiling prices and limits into an enum meant a release to change either, gave no way to
 * express "unlimited" except the sentinel 9999 (which the quota checker then enforced as a real
 * ceiling), and silently rewrote what every past customer appeared to have paid whenever a price
 * changed.
 *
 * <p>Kept as a tombstone so the old name doesn't quietly resolve to something else during review.
 * It holds no values; delete the file.
 */
@Deprecated(forRemoval = true)
public final class SubscriptionPlan {

    private SubscriptionPlan() {
        throw new UnsupportedOperationException("Use com.example.cafemangmentsystem.billing.entity.Plan");
    }
}
