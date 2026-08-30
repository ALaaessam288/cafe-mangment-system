package com.example.cafemangmentsystem.inventory.entity;

import com.example.cafemangmentsystem.common.entity.TenantScopedEntity;
import com.example.cafemangmentsystem.menu.entity.Product;
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

@Entity
@Table(name = "product_recipes")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProductRecipe extends TenantScopedEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "audit_item_id", nullable = false)
    private ShiftAuditItem auditItem;

    @Column(name = "deduction_quantity", nullable = false)
    private Double deductionQuantity; // e.g. 15.0 (grams), 0.15 (liters)

    public Product getProduct() { return product; }
    public void setProduct(Product product) { this.product = product; }

    public ShiftAuditItem getAuditItem() { return auditItem; }
    public void setAuditItem(ShiftAuditItem auditItem) { this.auditItem = auditItem; }

    public Double getDeductionQuantity() { return deductionQuantity; }
    public void setDeductionQuantity(Double deductionQuantity) { this.deductionQuantity = deductionQuantity; }
}
