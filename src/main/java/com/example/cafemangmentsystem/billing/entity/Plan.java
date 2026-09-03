package com.example.cafemangmentsystem.billing.entity;

import com.example.cafemangmentsystem.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.EnumSet;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * A sellable plan. Platform-level — deliberately NOT tenant-scoped.
 *
 * <p>This replaces the {@code SubscriptionPlan} enum, whose limits and prices were compiled into
 * the jar: changing the price of PRO meant a release, and every historical tenant silently
 * inherited the new number because nothing recorded what they had actually agreed to pay.
 * Prices are snapshotted onto {@link TenantSubscription} and {@link SubscriptionInvoice} at
 * purchase time, so editing a plan here never rewrites history.
 */
@Entity
@Table(name = "plans")
@Getter
@Setter
@NoArgsConstructor
public class Plan extends BaseEntity {

    /** Stable machine code (TRIAL, STARTER, PRO, ENTERPRISE, CUSTOM…). Referenced by license keys. */
    @Column(nullable = false, unique = true, length = 40)
    private String code;

    @Column(name = "display_name_ar", nullable = false)
    private String displayNameAr;

    @Column(name = "display_name_en")
    private String displayNameEn;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal price = BigDecimal.ZERO;

    @Column(nullable = false, length = 8)
    private String currency = "EGP";

    /** Length of one billing period. 30 = monthly, 365 = annual. */
    @Column(name = "billing_period_days", nullable = false)
    private int billingPeriodDays = 30;

    /** Only meaningful for the plan used at signup. */
    @Column(name = "trial_days", nullable = false)
    private int trialDays = 0;

    @Column(name = "max_tables", nullable = false)
    private int maxTables = 0;

    @Column(name = "max_users", nullable = false)
    private int maxUsers = 0;

    @Column(name = "max_products", nullable = false)
    private int maxProducts = 0;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "plan_features", joinColumns = @JoinColumn(name = "plan_id"))
    @Column(name = "feature", nullable = false, length = 40)
    @Enumerated(EnumType.STRING)
    private Set<Feature> features = new LinkedHashSet<>();

    /** Display order in the pricing grid. */
    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 0;

    /** Retired plans stay readable so existing subscriptions still resolve, but can't be bought. */
    @Column(nullable = false)
    private boolean active = true;

    /** Whether a tenant may self-select this plan during onboarding (TRIAL only, by default). */
    @Column(name = "self_selectable", nullable = false)
    private boolean selfSelectable = false;

    /** A CUSTOM plan is a per-deal shell; its limits are always overridden on the subscription. */
    @Column(name = "custom_plan", nullable = false)
    private boolean customPlan = false;

    public boolean hasFeature(Feature feature) {
        return features.contains(feature);
    }

    public EnumSet<Feature> featureSet() {
        return features.isEmpty() ? EnumSet.noneOf(Feature.class) : EnumSet.copyOf(features);
    }

    public int limitFor(QuotaType type) {
        return switch (type) {
            case TABLES -> maxTables;
            case USERS -> maxUsers;
            case PRODUCTS -> maxProducts;
        };
    }
}
