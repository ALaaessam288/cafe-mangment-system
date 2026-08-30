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

    @Column(name = "cost_per_unit")
    @Builder.Default
    private Double costPerUnit = 0.0;

    @Column(nullable = false)
    @Builder.Default
    private boolean active = true;

    public Double getCostPerUnit() { return costPerUnit != null ? costPerUnit : 0.0; }
    public void setCostPerUnit(Double costPerUnit) { this.costPerUnit = costPerUnit; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }

    public Double getStockQuantity() { return stockQuantity; }
    public void setStockQuantity(Double stockQuantity) { this.stockQuantity = stockQuantity; }

    public Double getMinThreshold() { return minThreshold; }
    public void setMinThreshold(Double minThreshold) { this.minThreshold = minThreshold; }

    public boolean isRequiresAudit() { return requiresAudit; }
    public void setRequiresAudit(boolean requiresAudit) { this.requiresAudit = requiresAudit; }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
}
