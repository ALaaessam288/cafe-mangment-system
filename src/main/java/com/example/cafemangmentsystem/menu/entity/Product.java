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

    public Category getCategory() { return category; }
    public void setCategory(Category category) { this.category = category; }

    public Station getStation() { return station; }
    public void setStation(Station station) { this.station = station; }

    public RevenueLine getRevenueLine() { return revenueLine; }
    public void setRevenueLine(RevenueLine revenueLine) { this.revenueLine = revenueLine; }

    public String getNameAr() { return nameAr; }
    public void setNameAr(String nameAr) { this.nameAr = nameAr; }

    public String getNameEn() { return nameEn; }
    public void setNameEn(String nameEn) { this.nameEn = nameEn; }

    public BigDecimal getPrice() { return price; }
    public void setPrice(BigDecimal price) { this.price = price; }

    public boolean isAvailable() { return available; }
    public void setAvailable(boolean available) { this.available = available; }

    public String getPrepNote() { return prepNote; }
    public void setPrepNote(String prepNote) { this.prepNote = prepNote; }

    public int getStockQuantity() { return stockQuantity; }
    public void setStockQuantity(int stockQuantity) { this.stockQuantity = stockQuantity; }

    public int getReservedQuantity() { return reservedQuantity; }
    public void setReservedQuantity(int reservedQuantity) { this.reservedQuantity = reservedQuantity; }

    public boolean isTrackInventory() { return trackInventory; }
    public void setTrackInventory(boolean trackInventory) { this.trackInventory = trackInventory; }

    public Integer getMinStockThreshold() { return minStockThreshold; }
    public void setMinStockThreshold(Integer minStockThreshold) { this.minStockThreshold = minStockThreshold; }
}