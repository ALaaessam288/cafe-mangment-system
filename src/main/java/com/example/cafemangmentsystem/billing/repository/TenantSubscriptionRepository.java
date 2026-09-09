package com.example.cafemangmentsystem.billing.repository;

import com.example.cafemangmentsystem.billing.entity.SubscriptionStatus;
import com.example.cafemangmentsystem.billing.entity.TenantSubscription;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
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

    /**
     * Every current subscription for a set of tenants, in one query with the plan joined.
     *
     * <p>Exists to kill an N+1: the tenant list called findByTenantIdAndCurrentTrue once per row,
     * so listing 500 cafes issued 501 queries and each of those lazily fetched a plan.
     */
    @Query("SELECT s FROM TenantSubscription s JOIN FETCH s.plan "
            + "WHERE s.current = true AND s.tenantId IN :tenantIds")
    List<TenantSubscription> findCurrentForTenants(@Param("tenantIds") Collection<Long> tenantIds);

    /** Status tally computed by the database rather than by resolving entitlements per tenant. */
    @Query("SELECT s.status, COUNT(s) FROM TenantSubscription s "
            + "WHERE s.current = true AND s.tenantId IN :tenantIds GROUP BY s.status")
    List<Object[]> countByStatusForTenants(@Param("tenantIds") Collection<Long> tenantIds);
}
