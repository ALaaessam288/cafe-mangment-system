package com.example.cafemangmentsystem.discount.entity;

import com.example.cafemangmentsystem.common.entity.TenantScopedEntity;
import com.example.cafemangmentsystem.order.entity.Order;
import com.example.cafemangmentsystem.order.entity.OrderItem;
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

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "discounts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Discount extends TenantScopedEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_item_id")
    private OrderItem item;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DiscountType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DiscountScope scope;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal value;

    @Column(name = "max_value", precision = 10, scale = 2)
    private BigDecimal maxValue;

    /** Always true in this system - every discount goes through an ADMIN/SUPERVISOR-gated endpoint. */
    @Column(name = "requires_supervisor", nullable = false)
    @Builder.Default
    private boolean requiresSupervisor = true;

    @Column(nullable = false)
    private String reason;

    /** The actual amount deducted after applying type/value and capping at maxValue and the applicable base. */
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal amount;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "applied_by", nullable = false)
    private User appliedBy;

    @Column(name = "applied_at", nullable = false)
    private Instant appliedAt;

    public Order getOrder() { return order; }
    public void setOrder(Order order) { this.order = order; }

    public OrderItem getItem() { return item; }
    public void setItem(OrderItem item) { this.item = item; }

    public DiscountType getType() { return type; }
    public void setType(DiscountType type) { this.type = type; }

    public DiscountScope getScope() { return scope; }
    public void setScope(DiscountScope scope) { this.scope = scope; }

    public BigDecimal getValue() { return value; }
    public void setValue(BigDecimal value) { this.value = value; }

    public BigDecimal getMaxValue() { return maxValue; }
    public void setMaxValue(BigDecimal maxValue) { this.maxValue = maxValue; }

    public boolean isRequiresSupervisor() { return requiresSupervisor; }
    public void setRequiresSupervisor(boolean requiresSupervisor) { this.requiresSupervisor = requiresSupervisor; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public User getAppliedBy() { return appliedBy; }
    public void setAppliedBy(User appliedBy) { this.appliedBy = appliedBy; }

    public Instant getAppliedAt() { return appliedAt; }
    public void setAppliedAt(Instant appliedAt) { this.appliedAt = appliedAt; }
}