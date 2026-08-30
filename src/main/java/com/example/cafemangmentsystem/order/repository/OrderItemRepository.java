package com.example.cafemangmentsystem.order.repository;

import com.example.cafemangmentsystem.order.entity.Order;
import com.example.cafemangmentsystem.order.entity.OrderItem;
import org.springframework.data.jpa.repository.JpaRepository;

import com.example.cafemangmentsystem.menu.entity.RevenueLine;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.Pageable;

public interface OrderItemRepository extends JpaRepository<OrderItem, Long> {

    List<OrderItem> findByOrder(Order order);

    List<OrderItem> findByOrderId(Long orderId);

    List<OrderItem> findAllByOrderId(Long orderId);

    @Query("SELECT COALESCE(SUM(oi.quantity), 0) FROM OrderItem oi " +
           "WHERE oi.product.id = :productId " +
           "AND oi.status = com.example.cafemangmentsystem.order.entity.OrderItemStatus.NEW")
    Long sumNewQuantityByProductId(@Param("productId") Long productId);

    @Query("SELECT COALESCE(SUM(oi.unitPriceSnapshot * oi.quantity - oi.discountAmount), 0) " +
           "FROM OrderItem oi JOIN oi.order o " +
           "WHERE o.shift.id = :shiftId AND oi.revenueLineSnapshot = :revenueLine " +
           "AND oi.status != com.example.cafemangmentsystem.order.entity.OrderItemStatus.CANCELLED " +
           "AND o.status != com.example.cafemangmentsystem.order.entity.OrderStatus.VOIDED")
    BigDecimal sumTotalByShiftIdAndRevenueLine(@Param("shiftId") Long shiftId, @Param("revenueLine") RevenueLine revenueLine);

    @Query("SELECT oi FROM OrderItem oi JOIN oi.order o " +
           "WHERE o.shift.id = :shiftId " +
           "AND oi.status != com.example.cafemangmentsystem.order.entity.OrderItemStatus.CANCELLED " +
           "AND o.status != com.example.cafemangmentsystem.order.entity.OrderStatus.VOIDED")
    List<OrderItem> findAllActiveByShiftId(@Param("shiftId") Long shiftId);

    @Query("SELECT oi.productNameSnapshot, SUM(oi.quantity), " +
           "COALESCE(SUM(oi.unitPriceSnapshot * oi.quantity - oi.discountAmount), 0) " +
           "FROM OrderItem oi JOIN oi.order o " +
           "WHERE oi.status != com.example.cafemangmentsystem.order.entity.OrderItemStatus.CANCELLED " +
           "AND o.status != com.example.cafemangmentsystem.order.entity.OrderStatus.VOIDED " +
           "AND (:start IS NULL OR o.createdAt >= :start) " +
           "AND (:end IS NULL OR o.createdAt < :end) " +
           "GROUP BY oi.productNameSnapshot " +
           "ORDER BY SUM(oi.quantity) DESC")
    List<Object[]> findTopProductsByQuantity(@Param("start") Instant start,
                                             @Param("end") Instant end,
                                             Pageable pageable);
}
