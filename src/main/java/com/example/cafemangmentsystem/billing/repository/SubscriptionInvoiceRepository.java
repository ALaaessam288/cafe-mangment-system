package com.example.cafemangmentsystem.billing.repository;

import com.example.cafemangmentsystem.billing.entity.InvoiceStatus;
import com.example.cafemangmentsystem.billing.entity.SubscriptionInvoice;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public interface SubscriptionInvoiceRepository extends JpaRepository<SubscriptionInvoice, Long> {

    List<SubscriptionInvoice> findByTenantIdOrderByIssuedAtDesc(Long tenantId);

    Page<SubscriptionInvoice> findByStatusOrderByIssuedAtDesc(InvoiceStatus status, Pageable pageable);

    Page<SubscriptionInvoice> findAllByOrderByIssuedAtDesc(Pageable pageable);

    boolean existsByInvoiceNumber(String invoiceNumber);

    long countBySubscriptionId(Long subscriptionId);

    @Query("""
            SELECT COALESCE(SUM(i.amountPaid), 0) FROM SubscriptionInvoice i
            WHERE i.paidAt >= :from AND i.paidAt < :to
            """)
    BigDecimal sumCollectedBetween(@Param("from") Instant from, @Param("to") Instant to);

    @Query("""
            SELECT COALESCE(SUM(i.amount - i.amountPaid), 0) FROM SubscriptionInvoice i
            WHERE i.status IN (com.example.cafemangmentsystem.billing.entity.InvoiceStatus.ISSUED,
                               com.example.cafemangmentsystem.billing.entity.InvoiceStatus.PARTIALLY_PAID)
            """)
    BigDecimal sumOutstanding();
}
