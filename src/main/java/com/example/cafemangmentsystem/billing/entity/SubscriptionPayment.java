package com.example.cafemangmentsystem.billing.entity;

import com.example.cafemangmentsystem.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

/** Money actually received against an invoice. Append-only; corrections are negative adjustments. */
@Entity
@Table(name = "subscription_payments", indexes = {
        @Index(name = "idx_subscription_payments_tenant", columnList = "tenant_id"),
        @Index(name = "idx_subscription_payments_invoice", columnList = "invoice_id"),
        @Index(name = "idx_subscription_payments_received", columnList = "received_at")
})
@Getter
@Setter
@NoArgsConstructor
public class SubscriptionPayment extends BaseEntity {

    @Column(name = "tenant_id", nullable = false)
    private Long tenantId;

    @Column(name = "invoice_id", nullable = false)
    private Long invoiceId;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount = BigDecimal.ZERO;

    @Column(nullable = false, length = 8)
    private String currency = "EGP";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private PaymentMethod method = PaymentMethod.CASH;

    /** Bank reference, licence key, wallet transaction id… */
    @Column(length = 120)
    private String reference;

    @Column(name = "received_at", nullable = false)
    private Instant receivedAt;

    @Column(name = "recorded_by", length = 120)
    private String recordedBy;

    @Column(length = 500)
    private String notes;
}
