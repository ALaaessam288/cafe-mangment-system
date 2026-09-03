package com.example.cafemangmentsystem.billing.entity;

import com.example.cafemangmentsystem.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * One redemption of a licence key.
 *
 * <p>Exists so that "how many times has this key been used" is a fact in the database rather than
 * a counter incremented after a separate read — the old {@code activationsCount++} was a
 * check-then-act race that let two concurrent requests both redeem a single-use key. The unique
 * constraint on {@code (license_key_id, tenant_id)} additionally makes double-redemption by the
 * same tenant impossible even under retry.
 */
@Entity
@Table(name = "license_key_activations",
        uniqueConstraints = @UniqueConstraint(name = "uk_license_activation_key_tenant",
                columnNames = {"license_key_id", "tenant_id"}),
        indexes = @Index(name = "idx_license_activations_key", columnList = "license_key_id"))
@Getter
@Setter
@NoArgsConstructor
public class LicenseKeyActivation extends BaseEntity {

    @Column(name = "license_key_id", nullable = false)
    private Long licenseKeyId;

    @Column(name = "tenant_id", nullable = false)
    private Long tenantId;

    @Column(name = "subscription_id")
    private Long subscriptionId;

    @Column(name = "activated_at", nullable = false)
    private Instant activatedAt;

    @Column(name = "activated_by", length = 120)
    private String activatedBy;
}
