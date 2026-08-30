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

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }

    public BusinessType getBusinessType() { return businessType; }
    public void setBusinessType(BusinessType businessType) { this.businessType = businessType; }

    public TenantStatus getStatus() { return status; }
    public void setStatus(TenantStatus status) { this.status = status; }

    public String getTimezone() { return timezone; }
    public void setTimezone(String timezone) { this.timezone = timezone; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public SubscriptionPlan getSubscriptionPlan() { return subscriptionPlan; }
    public void setSubscriptionPlan(SubscriptionPlan subscriptionPlan) { this.subscriptionPlan = subscriptionPlan; }

    public java.time.Instant getTrialEndsAt() { return trialEndsAt; }
    public void setTrialEndsAt(java.time.Instant trialEndsAt) { this.trialEndsAt = trialEndsAt; }

    public java.time.Instant getSubscriptionEndsAt() { return subscriptionEndsAt; }
    public void setSubscriptionEndsAt(java.time.Instant subscriptionEndsAt) { this.subscriptionEndsAt = subscriptionEndsAt; }

    public Integer getMaxTables() { return maxTables; }
    public void setMaxTables(Integer maxTables) { this.maxTables = maxTables; }

    public Integer getMaxUsers() { return maxUsers; }
    public void setMaxUsers(Integer maxUsers) { this.maxUsers = maxUsers; }

    public Integer getMaxProducts() { return maxProducts; }
    public void setMaxProducts(Integer maxProducts) { this.maxProducts = maxProducts; }

    public Integer getServiceChargePercent() { return serviceChargePercent; }
    public void setServiceChargePercent(Integer serviceChargePercent) { this.serviceChargePercent = serviceChargePercent; }

    public String getOwnerWhatsapp() { return ownerWhatsapp; }
    public void setOwnerWhatsapp(String ownerWhatsapp) { this.ownerWhatsapp = ownerWhatsapp; }

    public Boolean getWhatsappAlertsEnabled() { return whatsappAlertsEnabled; }
    public void setWhatsappAlertsEnabled(Boolean whatsappAlertsEnabled) { this.whatsappAlertsEnabled = whatsappAlertsEnabled; }

    public String getLogoUrl() { return logoUrl; }
    public void setLogoUrl(String logoUrl) { this.logoUrl = logoUrl; }

    public Boolean getPlanSelected() { return planSelected; }
    public void setPlanSelected(Boolean planSelected) { this.planSelected = planSelected; }
}
