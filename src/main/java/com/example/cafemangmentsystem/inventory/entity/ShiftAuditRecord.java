package com.example.cafemangmentsystem.inventory.entity;

import com.example.cafemangmentsystem.common.entity.TenantScopedEntity;
import com.example.cafemangmentsystem.shift.entity.Shift;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "shift_audit_records")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ShiftAuditRecord extends TenantScopedEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "shift_id", nullable = false)
    private Shift shift;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "audit_item_id", nullable = false)
    private ShiftAuditItem auditItem;

    @Column(name = "opening_count", nullable = false)
    private Double openingCount;

    @Column(name = "sold_deduction_count", nullable = false)
    @Builder.Default
    private Double soldDeductionCount = 0.0;

    @Column(name = "expected_closing_count")
    private Double expectedClosingCount;

    @Column(name = "actual_closing_count")
    private Double actualClosingCount;

    @Column(name = "variance_count")
    private Double varianceCount; // (Expected - Actual) -> Positive means waste/deficit

    @Column(name = "waste_percentage")
    private Double wastePercentage;

    @Column(name = "audited_at")
    private Instant auditedAt;
}
