package com.example.cafemangmentsystem.billing.repository;

import com.example.cafemangmentsystem.billing.entity.SubscriptionStatus;
import com.example.cafemangmentsystem.billing.entity.TenantSubscription;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface TenantSubscriptionRepository extends JpaRepository<TenantSubscription, Long> {

    Optional<TenantSubscription> findByTenantIdAndCurrentTrue(Long tenantId);

    List<TenantSubscription> findByTenantIdOrderByStartedAtDesc(Long tenantId);

    List<TenantSubscription> findByCurrentTrueAndStatus(SubscriptionStatus status);

    /** Live subscriptions whose paid period has run out — candidates for grace or expiry. */
    @Query("""
            SELECT s FROM TenantSubscription s
            WHERE s.current = true
              AND s.currentPeriodEnd IS NOT NULL
              AND s.currentPeriodEnd <= :now
              AND s.status IN (com.example.cafemangmentsystem.billing.entity.SubscriptionStatus.TRIALING,
                               com.example.cafemangmentsystem.billing.entity.SubscriptionStatus.ACTIVE,
                               com.example.cafemangmentsystem.billing.entity.SubscriptionStatus.GRACE)
            """)
    List<TenantSubscription> findLapsed(@Param("now") Instant now);

    /** Live subscriptions ending soon, for the expiry-warning pass. */
    @Query("""
            SELECT s FROM TenantSubscription s
            WHERE s.current = true
              AND s.currentPeriodEnd IS NOT NULL
              AND s.currentPeriodEnd > :now
              AND s.currentPeriodEnd <= :horizon
              AND s.status IN (com.example.cafemangmentsystem.billing.entity.SubscriptionStatus.TRIALING,
                               com.example.cafemangmentsystem.billing.entity.SubscriptionStatus.ACTIVE)
            """)
    List<TenantSubscription> findExpiringBefore(@Param("now") Instant now, @Param("horizon") Instant horizon);

    @Query("""
            SELECT COUNT(s) FROM TenantSubscription s
            WHERE s.current = true AND s.plan.id = :planId
            """)
    long countCurrentByPlan(@Param("planId") Long planId);

    List<TenantSubscription> findByCurrentTrue();
}
