package com.example.cafemangmentsystem.tenant.entity;

import com.example.cafemangmentsystem.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * The root of the tenant hierarchy - deliberately NOT tenant-scoped itself (it IS a tenant).
 * Every other business entity carries a {@code tenant_id} pointing back to one of these.
 */
@Entity
@Table(name = "tenants")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Tenant extends BaseEntity {

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String slug;

    @Enumerated(EnumType.STRING)
    @Column(name = "business_type", nullable = false)
    private BusinessType businessType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TenantStatus status;

    @Column(nullable = false)
    private String timezone;

    @Column(nullable = false)
    private String currency;

    @Enumerated(EnumType.STRING)
    @Column(name = "subscription_plan", nullable = false)
    @Builder.Default
    private SubscriptionPlan subscriptionPlan = SubscriptionPlan.TRIAL;

    @Column(name = "trial_ends_at")
    private java.time.Instant trialEndsAt;

    @Column(name = "subscription_ends_at")
    private java.time.Instant subscriptionEndsAt;

    @Column(name = "max_tables")
    private Integer maxTables;

    @Column(name = "max_users")
    private Integer maxUsers;

    @Column(name = "max_products")
    private Integer maxProducts;

    @Column(name = "service_charge_percent")
    private Integer serviceChargePercent;

    @Column(name = "owner_whatsapp")
    private String ownerWhatsapp;

    @Column(name = "whatsapp_alerts_enabled")
    @Builder.Default
    private Boolean whatsappAlertsEnabled = false;

    @Column(name = "logo_url", length = 1000000)
    private String logoUrl;

    @Column(name = "plan_selected")
    @Builder.Default
    private Boolean planSelected = false;
}
