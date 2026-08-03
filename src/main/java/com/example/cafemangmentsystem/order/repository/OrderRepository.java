package com.example.cafemangmentsystem.order.repository;

import com.example.cafemangmentsystem.order.entity.Order;
import com.example.cafemangmentsystem.order.entity.OrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

public interface OrderRepository extends JpaRepository<Order, Long> {

    @Query("SELECT COALESCE(MAX(o.orderNumber), 0) FROM Order o WHERE o.openedAt >= :startOfDay")
    Integer findMaxOrderNumberSince(@Param("startOfDay") Instant startOfDay);

    boolean existsByTableIdAndStatusIn(Long tableId, Collection<OrderStatus> statuses);

    List<Order> findAllByStatus(OrderStatus status);

    List<Order> findByStatus(OrderStatus status);
}