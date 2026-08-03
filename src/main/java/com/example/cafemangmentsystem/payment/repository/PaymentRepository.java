package com.example.cafemangmentsystem.payment.repository;

import com.example.cafemangmentsystem.payment.entity.Payment;
import com.example.cafemangmentsystem.payment.entity.PaymentMethod;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;

public interface PaymentRepository extends JpaRepository<Payment, Long> {

    List<Payment> findAllByOrderId(Long orderId);

    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM Payment p WHERE p.order.id = :orderId")
    BigDecimal sumAmountByOrderId(@Param("orderId") Long orderId);

    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM Payment p WHERE p.order.shift.id = :shiftId AND p.method = :method")
    BigDecimal sumAmountByShiftIdAndMethod(@Param("shiftId") Long shiftId, @Param("method") PaymentMethod method);
}