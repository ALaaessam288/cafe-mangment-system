package com.example.cafemangmentsystem.billing.entity;

import com.example.cafemangmentsystem.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * A customer asking to move onto a paid plan, paid for by bank transfer.
 *
 * <p>There is no payment gateway: the café transfers the money and the platform confirms it. That
 * flow existed only as a WhatsApp link — "تواصل لتجديد أو ترقية الاشتراك" — so an upgrade left no
 * record anywhere, nobody could tell which requests were outstanding, and the transfer reference
 * lived in someone's chat history. This makes the request a row: who asked, for what, when, what
 * they say they paid, and who approved it.
 *
 * <p>Platform-level, with a plain {@code tenant_id} so the super-admin can see every tenant's
 * requests without a tenant context.
 */
@Entity
@Table(name = "upgrade_requests", indexes = {
        @Index(name = "idx_upgrade_requests_tenant", columnList = "tenant_id"),
        @Index(name = "idx_upgrade_requests_status", columnList = "status")
})
@Getter
@Setter
@NoArgsConstructor
public class UpgradeRequest extends BaseEntity {

    @Column(name = "tenant_id", nullable = false)
    private Long tenantId;

    /** Requested plan, by code. Not a FK to plans: a request may outlive a retired plan. */
    @Column(name = "requested_plan_code", nullable = false, length = 40)
    private String requestedPlanCode;

    /** Null means the plan's own billing period. */
    @Column(name = "requested_period_days")
    private Integer requestedPeriodDays;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private UpgradeRequestStatus status = UpgradeRequestStatus.PENDING;

    /** What the platform quoted, frozen when the request was raised. */
    @Column(name = "quoted_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal quotedAmount = BigDecimal.ZERO;

    @Column(nullable = false, length = 8)
    private String currency = "EGP";

    /** How to reach whoever raised it — the platform has to call someone about the transfer. */
    @Column(name = "contact_name", length = 120)
    private String contactName;

    @Column(name = "contact_phone", length = 40)
    private String contactPhone;

    /** The customer's own reference for the transfer, so it can be matched on the statement. */
    @Column(name = "transfer_reference", length = 120)
    private String transferReference;

    @Column(name = "customer_note", length = 500)
    private String customerNote;

    @Column(name = "submitted_by", length = 120)
    private String submittedBy;

    @Column(name = "reviewed_by", length = 120)
    private String reviewedBy;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "review_note", length = 500)
    private String reviewNote;

    /** The amount actually received, which need not equal what was quoted. */
    @Column(name = "settled_amount", precision = 12, scale = 2)
    private BigDecimal settledAmount;

    /** The invoice raised on approval. */
    @Column(name = "invoice_id")
    private Long invoiceId;

    public boolean isOpen() {
        return status == UpgradeRequestStatus.PENDING;
    }
}
