package com.example.cafemangmentsystem.inventory.entity;

import com.example.cafemangmentsystem.common.entity.TenantScopedEntity;
import com.example.cafemangmentsystem.menu.entity.Product;
import com.example.cafemangmentsystem.user.entity.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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

/** Manual stock changes only (restock/waste/correction) - sale and cancel deductions happen inline on Product via OrderService and aren't logged here, since the Order/OrderItem records already audit those. */
@Entity
@Table(name = "stock_adjustments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StockAdjustment extends TenantScopedEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StockAdjustmentType type;

    /** Signed delta applied to the product's stock (positive for RESTOCK, negative for WASTE). */
    @Column(name = "quantity_change", nullable = false)
    private int quantityChange;

    /** Snapshot of the product's stock quantity right after this adjustment was applied. */
    @Column(name = "resulting_quantity", nullable = false)
    private int resultingQuantity;

    @Column(nullable = false)
    private String reason;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "adjusted_by", nullable = false)
    private User adjustedBy;

    @Column(name = "adjusted_at", nullable = false)
    private Instant adjustedAt;
}