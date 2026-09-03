package com.example.cafemangmentsystem.tenant.entity;

import com.example.cafemangmentsystem.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * The root of the tenant hierarchy — deliberately NOT tenant-scoped itself (it IS a tenant).
 * Every other business entity carries a {@code tenant_id} pointing back to one of these.
 *
 * <p>This row used to carry the tenant's commercial terms as well as its identity: the plan, two
 * end dates, and three quota columns that shadowed the plan's own limits. That made the plan a
 * mutable property of the customer with no history, so an upgrade destroyed the record of what came
 * before and the two admin endpoints that wrote those columns could not agree on what they meant.
 * All of it now lives on {@code tenant_subscriptions}; what remains here is identity and
 * preferences.
 */
@Entity
@Table(name = "tenants")
@Getter
@Setter
@NoArgsConstructor
public class Tenant extends BaseEntity {

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String slug;

    @Enumerated(EnumType.STRING)
    @Column(name = "business_type", nullable = false)
    private BusinessType businessType;

    /**
     * Administrative state, mirrored from the current subscription by
     * {@code SubscriptionService.syncTenant}. Authoritative only for SUSPENDED, which the platform
     * sets directly and which outranks whatever the subscription says.
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TenantStatus status = TenantStatus.TRIAL;

    @Column(nullable = false)
    private String timezone = "Africa/Cairo";

    @Column(nullable = false)
    private String currency = "EGP";

    @Column(name = "service_charge_percent")
    private Integer serviceChargePercent;

    @Column(name = "owner_whatsapp")
    private String ownerWhatsapp;

    @Column(name = "whatsapp_alerts_enabled", nullable = false)
    private Boolean whatsappAlertsEnabled = false;

    @Column(name = "logo_url", length = 1000000)
    private String logoUrl;

    /** Whether the owner has been through the first-run plan picker. */
    @Column(name = "plan_selected", nullable = false)
    private Boolean planSelected = false;
}
