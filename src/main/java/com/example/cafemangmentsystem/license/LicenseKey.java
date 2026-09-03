package com.example.cafemangmentsystem.license;

import com.example.cafemangmentsystem.billing.entity.Plan;
import com.example.cafemangmentsystem.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * A pre-sold subscription, redeemable offline. Platform-level — not tenant-scoped.
 *
 * <p>The previous model had a single {@code expiresAt} column doing two incompatible jobs: it was
 * both the deadline for redeeming the key <em>and</em> the end of the subscription the key granted.
 * A 365-day key sold in January and redeemed in November therefore bought the customer six weeks.
 * Those are now two fields: {@link #redeemableUntil} bounds redemption, {@link #durationDays}
 * defines how much subscription the redemption grants, counted from the moment it is redeemed.
 */
@Entity
@Table(name = "license_keys", indexes = {
        @Index(name = "idx_license_keys_plan", columnList = "plan_id")
})
@Getter
@Setter
@NoArgsConstructor
public class LicenseKey extends BaseEntity {

    @Column(name = "license_key", nullable = false, unique = true, length = 32)
    private String key;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "plan_id", nullable = false)
    private Plan plan;

    /** How much subscription one redemption grants. 0 means perpetual (a lifetime licence). */
    @Column(name = "duration_days", nullable = false)
    private int durationDays = 30;

    /** Redemption deadline. Null = redeemable forever. Distinct from the subscription it grants. */
    @Column(name = "redeemable_until")
    private Instant redeemableUntil;

    /** How many tenants may redeem this key. Site licences and resellers use more than one. */
    @Column(name = "max_activations", nullable = false)
    private int maxActivations = 1;

    /**
     * Denormalised count kept in step with {@code license_key_activations}. Read for display only —
     * redemption decides on the activation rows under a pessimistic lock, never on this number.
     */
    @Column(name = "activations_count", nullable = false)
    private int activationsCount = 0;

    /** What the customer paid for the key, so redeeming it can raise a real paid invoice. */
    @Column(name = "price", nullable = false, precision = 12, scale = 2)
    private BigDecimal price = BigDecimal.ZERO;

    @Column(nullable = false, length = 8)
    private String currency = "EGP";

    @Column(nullable = false)
    private boolean revoked = false;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Column(name = "revoke_reason", length = 500)
    private String revokeReason;

    /** Free-text for the platform admin: customer name, order id, reseller. */
    @Column(length = 500)
    private String notes;

    public boolean isPerpetual() {
        return durationDays <= 0;
    }

    public boolean isFullyActivated() {
        return activationsCount >= maxActivations;
    }

    /** Past its redemption deadline. Says nothing about the subscription a redemption granted. */
    public boolean isRedemptionWindowClosed() {
        return redeemableUntil != null && Instant.now().isAfter(redeemableUntil);
    }

    public boolean isRedeemable() {
        return !revoked && !isRedemptionWindowClosed() && !isFullyActivated();
    }
}
