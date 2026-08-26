package com.example.cafemangmentsystem.menu.entity;

import com.example.cafemangmentsystem.common.entity.SoftDeletableEntity;
import com.example.cafemangmentsystem.station.entity.Station;
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

@Entity
@Table(name = "products")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Product extends SoftDeletableEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id", nullable = false)
    private Category category;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "station_id", nullable = false)
    private Station station;

    @Enumerated(EnumType.STRING)
    @Column(name = "revenue_line", nullable = false)
    private RevenueLine revenueLine;

    @Column(name = "name_ar", nullable = false)
    private String nameAr;

    @Column(name = "name_en")
    private String nameEn;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    @Column(nullable = false)
    @Builder.Default
    private boolean available = true;

    @Column(name = "prep_note")
    private String prepNote;

    @Column(name = "stock_quantity", nullable = false)
    @Builder.Default
    private int stockQuantity = 0;

    /**
     * Quantity held by NEW (not yet sent) order items across all open orders - a soft
     * reservation. Prevents two cashiers from overselling the last units of a product between
     * the moment it's added to a cart and the moment it's actually sent to the kitchen, since
     * stock_quantity itself is only decremented at send() time (see OrderService). Always <=
     * stock_quantity in practice; availableQuantity (exposed to the frontend) is stockQuantity
     * minus this.
     */
    @Column(name = "reserved_quantity", nullable = false)
    @Builder.Default
    private int reservedQuantity = 0;

    @Column(name = "track_inventory", nullable = false)
    @Builder.Default
    private boolean trackInventory = false;

    @Column(name = "min_stock_threshold")
    private Integer minStockThreshold;
}