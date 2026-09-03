package com.example.cafemangmentsystem.billing.repository;

import com.example.cafemangmentsystem.billing.entity.SubscriptionPayment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;

public interface SubscriptionPaymentRepository extends JpaRepository<SubscriptionPayment, Long> {

    List<SubscriptionPayment> findByInvoiceIdOrderByReceivedAtAsc(Long invoiceId);

    List<SubscriptionPayment> findByTenantIdOrderByReceivedAtDesc(Long tenantId);

    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM SubscriptionPayment p WHERE p.invoiceId = :invoiceId")
    BigDecimal sumForInvoice(@Param("invoiceId") Long invoiceId);
}
