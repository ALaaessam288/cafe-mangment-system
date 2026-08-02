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
}
