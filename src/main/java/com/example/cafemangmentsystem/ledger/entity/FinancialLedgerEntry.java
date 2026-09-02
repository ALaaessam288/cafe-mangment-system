package com.example.cafemangmentsystem.ledger.entity;

import com.example.cafemangmentsystem.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "financial_ledger_entries")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FinancialLedgerEntry extends BaseEntity {

    @Enumerated(EnumType.STRING)
    @Column(name = "entry_type", nullable = false)
    private FinancialLedgerEntryType entryType;

    @Column(name = "amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(name = "debit_account", nullable = false)
    private FinancialAccount debitAccount;

    @Enumerated(EnumType.STRING)
    @Column(name = "credit_account", nullable = false)
    private FinancialAccount creditAccount;

    @Column(name = "reference_type")
    private String referenceType;

    @Column(name = "reference_id")
    private Long referenceId;

    @Column(name = "shift_id")
    private Long shiftId;

    @Column(name = "performed_by_id")
    private Long performedById;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    @Column(name = "notes")
    private String notes;
}
