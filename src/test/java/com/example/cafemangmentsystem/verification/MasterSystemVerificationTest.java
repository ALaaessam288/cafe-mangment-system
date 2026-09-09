package com.example.cafemangmentsystem.verification;

import com.example.cafemangmentsystem.billing.dto.AccessLevel;
import com.example.cafemangmentsystem.billing.dto.Entitlements;
import com.example.cafemangmentsystem.billing.entity.Feature;
import com.example.cafemangmentsystem.billing.entity.QuotaType;
import com.example.cafemangmentsystem.billing.entity.SubscriptionStatus;
import com.example.cafemangmentsystem.common.idempotency.IdempotencyService;
import com.example.cafemangmentsystem.common.idempotency.InMemoryIdempotencyRepository;
import com.example.cafemangmentsystem.common.tenant.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Entitlement behaviour that the rest of the system reads as truth.
 *
 * <p>This file previously asserted against {@code tenant.entity.SubscriptionPlan}, the hardcoded
 * enum the billing rework replaced, so it stopped compiling and took the whole test module - and
 * therefore {@code mvn test} - down with it. It also held a run of tautologies
 * ({@code assertNotEquals(NEW, SENT)} on two enum constants, arithmetic computed in the test and
 * asserted against itself) which could not fail whatever the production code did. Replaced with
 * assertions that exercise {@link Entitlements}, where the real decisions are made.
 */
public class MasterSystemVerificationTest {

    @BeforeEach
    public void setUp() {
        TenantContext.set(1L);
    }

    @AfterEach
    public void tearDown() {
        TenantContext.clear();
    }

    private static Entitlements entitlements(SubscriptionStatus status, Instant periodEnd,
                                             Instant graceEndsAt, Set<Feature> features,
                                             Map<QuotaType, Integer> limits) {
        return new Entitlements(1L, 99L, "PRO", "Professional", status,
                status == SubscriptionStatus.EXPIRED ? AccessLevel.READ_ONLY : AccessLevel.FULL,
                features, limits, periodEnd, graceEndsAt, false);
    }

    @Test
    public void featureNotOnThePlanIsNotGranted() {
        Entitlements e = entitlements(SubscriptionStatus.ACTIVE,
                Instant.now().plus(20, ChronoUnit.DAYS), null,
                EnumSet.of(Feature.POS, Feature.REPORTS), Map.of());

        assertTrue(e.has(Feature.POS));
        assertFalse(e.has(Feature.KDS), "KDS was not on the plan and must not be granted");
        assertFalse(e.has(Feature.MULTI_BRANCH));
    }

    @Test
    public void unlimitedIsASentinelNotACeiling() {
        Entitlements e = entitlements(SubscriptionStatus.ACTIVE,
                Instant.now().plus(20, ChronoUnit.DAYS), null,
                EnumSet.of(Feature.POS),
                Map.of(QuotaType.TABLES, QuotaType.UNLIMITED, QuotaType.USERS, 5));

        assertTrue(QuotaType.isUnlimited(e.limit(QuotaType.TABLES)));
        assertFalse(QuotaType.isUnlimited(e.limit(QuotaType.USERS)));
        // The retired model spelled "unlimited" as 9999 and then enforced it as a hard stop.
        assertNotEquals(9999, e.limit(QuotaType.TABLES));
    }

    @Test
    public void quotaTypeWithNoStatedLimitDeniesRatherThanAllows() {
        Entitlements e = entitlements(SubscriptionStatus.ACTIVE,
                Instant.now().plus(20, ChronoUnit.DAYS), null, EnumSet.of(Feature.POS), Map.of());

        assertEquals(0, e.limit(QuotaType.PRODUCTS));
        assertFalse(QuotaType.isUnlimited(e.limit(QuotaType.PRODUCTS)));
    }

    @Test
    public void daysRemainingCountsToThePaidPeriodNotThroughGrace() {
        // A fresh 14-day trial with a 4-day grace window behind it. Backed off by a second so the
        // boundary is deterministically just under 14 days regardless of clock resolution between
        // this call and the daysRemaining() call below.
        Instant periodEnd = Instant.now().plus(14, ChronoUnit.DAYS).minusSeconds(1);
        Instant graceEnd = periodEnd.plus(4, ChronoUnit.DAYS);
        Entitlements e = entitlements(SubscriptionStatus.TRIALING, periodEnd, graceEnd,
                EnumSet.of(Feature.POS), Map.of());

        // Counting through grace reported 18 days on a 14-day trial - a promise the account
        // does not keep, because writes are already restricted once grace begins.
        assertEquals(13L, e.daysRemaining(), "must count to the end of what was actually sold");
    }

    @Test
    public void onceInGraceTheCountdownBecomesTheGraceDeadline() {
        Instant periodEnd = Instant.now().minus(1, ChronoUnit.DAYS);
        // Backed off by a second, for the same reason as above: deterministically just under 3 days.
        Instant graceEnd = Instant.now().plus(3, ChronoUnit.DAYS).minusSeconds(1);
        Entitlements e = entitlements(SubscriptionStatus.GRACE, periodEnd, graceEnd,
                EnumSet.of(Feature.POS), Map.of());

        assertTrue(e.inGrace());
        assertEquals(2L, e.daysRemaining(), "in grace, the real deadline is when writes stop");
    }

    @Test
    public void daysRemainingNeverGoesNegative() {
        Entitlements e = entitlements(SubscriptionStatus.EXPIRED,
                Instant.now().minus(30, ChronoUnit.DAYS), null, Set.of(), Map.of());

        assertEquals(0L, e.daysRemaining());
    }

    @Test
    public void anUnresolvableSubscriptionIsReadableButGrantsNothing() {
        Entitlements none = Entitlements.none(1L);

        assertTrue(none.canRead());
        assertFalse(none.canWrite());
        for (Feature f : Feature.values()) {
            assertFalse(none.has(f), f + " must not be granted without a subscription");
        }
    }

    @Test
    public void platformTenantIsFullyEntitledWithoutHoldingAPlan() {
        Entitlements platform = Entitlements.platform();

        assertTrue(platform.canWrite());
        assertTrue(platform.perpetual());
        assertNull(platform.daysRemaining(), "perpetual access has no countdown");
        for (Feature f : Feature.values()) {
            assertTrue(platform.has(f));
        }
        assertTrue(QuotaType.isUnlimited(platform.limit(QuotaType.TABLES)));
    }

    @Test
    public void idempotentRequestsReplayTheFirstResultInsteadOfActingTwice() {
        IdempotencyService idempotency = InMemoryIdempotencyRepository.service();
        String key = "checkout-abc";

        Object first = idempotency.get(key);
        assertNull(first, "an unseen key must not resolve to anything");

        idempotency.put(key, "ORDER-1");
        assertEquals("ORDER-1", idempotency.get(key));
        assertEquals("ORDER-1", idempotency.get(key), "replay must be stable");
    }
}
