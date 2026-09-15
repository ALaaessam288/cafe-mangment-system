package com.example.cafemangmentsystem.menu.entity;

import com.example.cafemangmentsystem.common.entity.TenantScopedEntity;
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

import java.math.BigDecimal;

@Entity
@Table(name = "product_options")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProductOption extends TenantScopedEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(name = "name_ar", nullable = false)
    private String nameAr;

    @Column(name = "price_delta", nullable = false, precision = 10, scale = 2)
    private BigDecimal priceDelta;

    @Column(name = "is_default", nullable = false)
    @Builder.Default
    private boolean isDefault = false;

    /**
     * Which question this option answers: SIZE, SUGAR, SPICE, or ADDON.
     *
     * <p>Single-select applies within a group and not across them, so a drink can carry both a size
     * and a sugar level without the two fighting. ADDON is the open case - extras, multi-select.
     */
    @Column(name = "option_group", length = 32)
    private String optionGroup = "ADDON";

    public Product getProduct() { return product; }
    public void setProduct(Product product) { this.product = product; }

    public String getNameAr() { return nameAr; }
    public void setNameAr(String nameAr) { this.nameAr = nameAr; }

    public BigDecimal getPriceDelta() { return priceDelta; }
    public void setPriceDelta(BigDecimal priceDelta) { this.priceDelta = priceDelta; }

    public boolean isDefault() { return isDefault; }
    public void setDefault(boolean aDefault) { isDefault = aDefault; }
}