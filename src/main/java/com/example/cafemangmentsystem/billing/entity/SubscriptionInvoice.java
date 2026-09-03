package com.example.cafemangmentsystem.billing.entity;

import com.example.cafemangmentsystem.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * What a tenant was billed for one subscription period.
 *
 * <p>Plan code and name are snapshotted rather than joined, so a later rename or repricing of the
 * plan cannot retroactively change an issued invoice.
 */
@Entity
@Table(name = "subscription_invoices", indexes = {
        @Index(name = "idx_subscription_invoices_tenant", columnList = "tenant_id"),
        @Index(name = "idx_subscription_invoices_status", columnList = "status"),
        @Index(name = "idx_subscription_invoices_issued", columnList = "issued_at")
})
@Getter
@Setter
@NoArgsConstructor
public class SubscriptionInvoice extends BaseEntity {

    @Column(name = "invoice_number", nullable = false, unique = true, length = 40)
    private String invoiceNumber;

    @Column(name = "tenant_id", nullable = false)
    private Long tenantId;

    @Column(name = "subscription_id", nullable = false)
    private Long subscriptionId;

    @Column(name = "plan_code", nullable = false, length = 40)
    private String planCode;

    @Column(name = "plan_name", nullable = false)
    private String planName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private InvoiceStatus status = InvoiceStatus.ISSUED;

    @Column(name = "period_start", nullable = false)
    private Instant periodStart;

    @Column(name = "period_end")
    private Instant periodEnd;

    @Column(name = "issued_at", nullable = false)
    private Instant issuedAt;

    @Column(name = "due_at")
    private Instant dueAt;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount = BigDecimal.ZERO;

    @Column(name = "amount_paid", nullable = false, precision = 12, scale = 2)
    private BigDecimal amountPaid = BigDecimal.ZERO;

    @Column(nullable = false, length = 8)
    private String currency = "EGP";

    @Column(name = "paid_at")
    private Instant paidAt;

    @Column(length = 500)
    private String notes;

    public BigDecimal outstanding() {
        return amount.subtract(amountPaid).max(BigDecimal.ZERO);
    }
}
