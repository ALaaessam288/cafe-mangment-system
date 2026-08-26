package com.example.cafemangmentsystem.inventory.entity;

import com.example.cafemangmentsystem.common.entity.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "shift_audit_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ShiftAuditItem extends TenantScopedEntity {

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String unit; // e.g. جرام, لتر, كيس, قطعة, علبة

    @Column(name = "stock_quantity", nullable = false)
    @Builder.Default
    private Double stockQuantity = 0.0;

    @Column(name = "min_threshold")
    @Builder.Default
    private Double minThreshold = 0.0;

    @Column(name = "requires_audit", nullable = false)
    @Builder.Default
    private boolean requiresAudit = true;

    @Column(nullable = false)
    @Builder.Default
    private boolean active = true;
}
