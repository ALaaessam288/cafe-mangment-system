package com.example.cafemangmentsystem.order.dto;

import com.example.cafemangmentsystem.order.entity.Order;
import com.example.cafemangmentsystem.order.entity.OrderStatus;
import com.example.cafemangmentsystem.order.entity.OrderType;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record OrderResponse(
        Long id,
        Integer orderNumber,
        Long tableId,
        Integer tableNumber,
        OrderType type,
        OrderStatus status,
        Long openedByUserId,
        Long closedByUserId,
        Long servedByUserId,
        Long shiftId,
        BigDecimal subtotal,
        BigDecimal discount,
        BigDecimal service,
        BigDecimal total,
        BigDecimal amountPaid,
        BigDecimal balanceDue,
        Integer guestCount,
        String customerName,
        String customerPhone,
        Instant pickupAt,
        Instant openedAt,
        Instant closedAt,
        Instant servedAt,
        String voidReason,
        List<OrderItemResponse> items
) {
    public static OrderResponse from(Order order, List<OrderItemResponse> items, BigDecimal amountPaid) {
        BigDecimal balanceDue = order.getTotal().subtract(amountPaid);
        return new OrderResponse(
                order.getId(),
                order.getOrderNumber(),
                order.getTable() == null ? null : order.getTable().getId(),
                order.getTable() == null ? null : order.getTable().getNumber(),
                order.getType(),
                order.getStatus(),
                order.getOpenedBy().getId(),
                order.getClosedBy() == null ? null : order.getClosedBy().getId(),
                order.getServedBy() == null ? null : order.getServedBy().getId(),
                order.getShift().getId(),
                order.getSubtotal(),
                order.getDiscount(),
                order.getService(),
                order.getTotal(),
                amountPaid,
                balanceDue,
                order.getGuestCount(),
                order.getCustomerName(),
                order.getCustomerPhone(),
                order.getPickupAt(),
                order.getOpenedAt(),
                order.getClosedAt(),
                order.getServedAt(),
                order.getVoidReason(),
                items);
    }
}