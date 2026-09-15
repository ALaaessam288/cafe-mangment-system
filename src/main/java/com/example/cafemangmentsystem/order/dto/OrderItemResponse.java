package com.example.cafemangmentsystem.order.dto;

import com.example.cafemangmentsystem.menu.entity.RevenueLine;
import com.example.cafemangmentsystem.order.entity.OrderItem;
import com.example.cafemangmentsystem.order.entity.OrderItemStatus;
import com.example.cafemangmentsystem.station.entity.StationCode;

import java.math.BigDecimal;

public record OrderItemResponse(
        Long id,
        Long productId,
        String productNameSnapshot,
        String categoryNameSnapshot,
        BigDecimal unitPriceSnapshot,
        StationCode stationSnapshot,
        RevenueLine revenueLineSnapshot,
        Integer quantity,
        OrderItemStatus status,
        String note,
        Long addedByUserId,
        Long cancelledByUserId,
        String cancelReason,
        BigDecimal discountAmount,
        BigDecimal lineTotal
) {
    public static OrderItemResponse from(OrderItem item) {
        BigDecimal grossLineTotal = item.getUnitPriceSnapshot().multiply(BigDecimal.valueOf(item.getQuantity()));
        return new OrderItemResponse(
                item.getId(),
                // Null once the product has been deleted. Every other field on this line is a
                // snapshot taken at the time of sale, so the line still renders and still totals
                // correctly - it just cannot be re-ordered from, which is the point.
                item.getProduct() == null ? null : item.getProduct().getId(),
                item.getProductNameSnapshot(),
                item.getCategoryNameSnapshot(),
                item.getUnitPriceSnapshot(),
                item.getStationSnapshot(),
                item.getRevenueLineSnapshot(),
                item.getQuantity(),
                item.getStatus(),
                item.getNote(),
                item.getAddedBy().getId(),
                item.getCancelledBy() == null ? null : item.getCancelledBy().getId(),
                item.getCancelReason(),
                item.getDiscountAmount(),
                grossLineTotal.subtract(item.getDiscountAmount()));
    }
}