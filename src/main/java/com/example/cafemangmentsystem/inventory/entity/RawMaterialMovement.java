package com.example.cafemangmentsystem.inventory.entity;

import com.example.cafemangmentsystem.common.entity.TenantScopedEntity;
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

import java.math.BigDecimal;
import java.time.Instant;

/**
 * One recorded change to a raw material's stock.
 *
 * <p>Finished products have had a {@code stock_adjustments} ledger all along. Raw materials — beans,
 * milk, cups, the things a café's money is actually tied up in — had none: stock was changed by
 * writing a new number over the old one through the audit-item endpoint. "Bought 5 kg of beans for
 * 900 EGP" left no purchase, no cost and no attribution, and afterwards there was no way to tell a
 * delivery from a typo. Because cost of goods sold is derived from these balances, every profit
 * figure downstream inherited that uncertainty.
 *
 * <p>Consumption from recipes is deliberately <em>not</em> written here. It happens on every ticket
 * sent to the kitchen, and the shift audit record already carries the per-shift total in
 * {@code soldDeductionCount}; a row per order item would multiply write volume for a number that is
 * already reconciled at the shift boundary.
 */
@Entity
@Table(name = "raw_material_movements")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RawMaterialMovement extends TenantScopedEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "audit_item_id", nullable = false)
    private ShiftAuditItem auditItem;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private RawMaterialMovementType type;

    /** Signed delta in the material's own unit: positive for a delivery, negative for waste. */
    @Column(name = "quantity_change", nullable = false)
    private Double quantityChange;

    /** The balance after this movement was applied, so the ledger can be read without replaying it. */
    @Column(name = "resulting_quantity", nullable = false)
    private Double resultingQuantity;

    /** What one unit cost on this movement. Null when the movement is a recount, not a purchase. */
    @Column(name = "unit_cost", precision = 12, scale = 4)
    private BigDecimal unitCost;

    /** {@code |quantityChange| × unitCost}, stored so a historic cost survives a later price change. */
    @Column(name = "total_cost", precision = 14, scale = 2)
    private BigDecimal totalCost;

    @Column(length = 500)
    private String reason;

    /** Supplier invoice number, delivery note, or whatever ties this row to a piece of paper. */
    @Column(length = 120)
    private String reference;

    /** The shift this happened in, when it happened during one. */
    @Column(name = "shift_id")
    private Long shiftId;

    @Column(name = "performed_by", length = 120)
    private String performedBy;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;
}
