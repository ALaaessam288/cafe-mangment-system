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

    /**
     * The orders currently occupying a table. Callers used to fetch every order in a status and
     * filter in memory - three full scans of the orders table to answer a question about one
     * table.
     */
    List<Order> findByTableIdAndStatusIn(Long tableId, Collection<OrderStatus> statuses);

    List<Order> findAllByStatus(OrderStatus status);

    List<Order> findByStatus(OrderStatus status);

    List<Order> findAllByShiftId(Long shiftId);

    List<Order> findAllByShiftIdAndStatusIn(Long shiftId, Collection<OrderStatus> statuses);

    boolean existsByShiftIdAndStatusIn(Long shiftId, Collection<OrderStatus> statuses);

    @Query("SELECT EXTRACT(HOUR FROM o.createdAt), COUNT(o.id), " +
           "COALESCE(SUM(CASE WHEN o.status != com.example.cafemangmentsystem.order.entity.OrderStatus.VOIDED THEN o.total ELSE 0 END), 0) " +
           "FROM Order o " +
           "WHERE o.status != com.example.cafemangmentsystem.order.entity.OrderStatus.VOIDED " +
           "AND (:start IS NULL OR o.createdAt >= :start) " +
           "AND (:end IS NULL OR o.createdAt < :end) " +
           "GROUP BY EXTRACT(HOUR FROM o.createdAt) " +
           "ORDER BY EXTRACT(HOUR FROM o.createdAt)")
    List<Object[]> findHourlySales(@Param("start") Instant start, @Param("end") Instant end);

    @Query("SELECT o.createdAt, COUNT(o.id) FROM Order o " +
           "WHERE o.status != com.example.cafemangmentsystem.order.entity.OrderStatus.VOIDED " +
           "AND (:start IS NULL OR o.createdAt >= :start) " +
           "AND (:end IS NULL OR o.createdAt < :end) " +
           "GROUP BY FUNCTION('date_trunc', 'day', o.createdAt) " +
           "ORDER BY o.createdAt")
    List<Object[]> findDailyCounts(@Param("start") Instant start, @Param("end") Instant end);
}
