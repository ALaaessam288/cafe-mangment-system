package com.example.cafemangmentsystem.billing;

import com.example.cafemangmentsystem.billing.entity.*;
import com.example.cafemangmentsystem.billing.repository.PlanRepository;
import com.example.cafemangmentsystem.billing.repository.TenantSubscriptionRepository;
import com.example.cafemangmentsystem.common.tenant.CurrentActor;
import com.example.cafemangmentsystem.tenant.entity.Tenant;
import com.example.cafemangmentsystem.tenant.entity.TenantActivityLog;
import com.example.cafemangmentsystem.tenant.entity.TenantStatus;
import com.example.cafemangmentsystem.tenant.repository.TenantActivityLogRepository;
import com.example.cafemangmentsystem.tenant.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Owns every transition of a tenant's subscription.
 *
 * <p>Previously this logic was spread across three places that disagreed with each other:
 * {@code updateTenantSubscription} reset a tenant's quotas to plan defaults (destroying bespoke
 * deals), {@code customizeTenantPlan} changed the plan but kept the old quotas, and
 * {@code activateTenantLicense} did a third thing. Plan changes now go through
 * {@link #changePlan} alone, and per-tenant deviations are explicit overrides on the
 * subscription rather than mutable columns on the tenant.
 */
@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class SubscriptionService {

    private final TenantSubscriptionRepository subscriptionRepository;
    private final PlanRepository planRepository;
    private final TenantRepository tenantRepository;
    private final TenantActivityLogRepository activityLogRepository;
    private final BillingService billingService;
    private final EntitlementService entitlementService;
    private final BillingProperties properties;

    // ── Reads ───────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Optional<TenantSubscription> currentFor(Long tenantId) {
        return subscriptionRepository.findByTenantIdAndCurrentTrue(tenantId);
    }

    @Transactional(readOnly = true)
    public TenantSubscription requireCurrent(Long tenantId) {
        return currentFor(tenantId).orElseThrow(() -> new ResponseStatusException(
                HttpStatus.NOT_FOUND, "No subscription for tenant " + tenantId));
    }

    @Transactional(readOnly = true)
    public List<TenantSubscription> historyFor(Long tenantId) {
        return subscriptionRepository.findByTenantIdOrderByStartedAtDesc(tenantId);
    }

    // ── Lifecycle ───────────────────────────────────────────────────────────

    /**
     * Starts the free trial for a freshly provisioned tenant. The trial length comes from the plan
     * (falling back to platform config), not from a 14 hardcoded in three different methods.
     */
    public TenantSubscription startTrial(Long tenantId, Plan trialPlan) {
        Instant now = Instant.now();
        int trialDays = trialPlan.getTrialDays() > 0 ? trialPlan.getTrialDays() : properties.getTrialDays();

        TenantSubscription subscription = new TenantSubscription();
        subscription.setTenantId(tenantId);
        subscription.setPlan(trialPlan);
        subscription.setStatus(SubscriptionStatus.TRIALING);
        subscription.setSource(SubscriptionSource.TRIAL_SIGNUP);
        subscription.setStartedAt(now);
        subscription.setCurrentPeriodStart(now);
        subscription.setCurrentPeriodEnd(now.plus(Duration.ofDays(trialDays)));
        subscription.setPriceAtPurchase(BigDecimal.ZERO);
        subscription.setCurrency(trialPlan.getCurrency());

        return persistAsCurrent(subscription, "TRIAL_STARTED",
                "بدأت الفترة التجريبية (" + trialDays + " يوم)");
    }

    /**
     * Moves a tenant onto a different plan, opening a new period.
     *
     * @param overrides bespoke limits for this deal, or null to inherit the plan's. Passing null on
     *                  an upgrade is the common case and correctly drops a previous custom deal.
     */
    public TenantSubscription changePlan(Long tenantId, String planCode, Integer periodDays,
                                         BigDecimal negotiatedPrice, SubscriptionSource source,
                                         QuotaOverrides overrides, String note) {
        Plan plan = requirePlan(planCode);
        TenantSubscription previous = currentFor(tenantId).orElse(null);
        Instant now = Instant.now();

        int days = periodDays != null && periodDays > 0 ? periodDays : plan.getBillingPeriodDays();
        BigDecimal price = negotiatedPrice != null ? negotiatedPrice : plan.getPrice();

        TenantSubscription subscription = new TenantSubscription();
        subscription.setTenantId(tenantId);
        subscription.setPlan(plan);
        subscription.setStatus(plan.getTrialDays() > 0 && price.compareTo(BigDecimal.ZERO) == 0
                ? SubscriptionStatus.TRIALING : SubscriptionStatus.ACTIVE);
        subscription.setSource(source != null ? source : SubscriptionSource.MANUAL_ADMIN);
        subscription.setStartedAt(now);
        subscription.setCurrentPeriodStart(now);
        // Carry over unused time from a still-live period so upgrading mid-month never costs days.
        Instant base = previous != null && previous.getCurrentPeriodEnd() != null
                && previous.getCurrentPeriodEnd().isAfter(now) && previous.getStatus().isLive()
                ? previous.getCurrentPeriodEnd() : now;
        subscription.setCurrentPeriodEnd(days > 0 ? base.plus(Duration.ofDays(days)) : null);
        subscription.setPriceAtPurchase(price);
        subscription.setCurrency(plan.getCurrency());
        subscription.setNotes(note);
        applyOverrides(subscription, overrides, plan);

        TenantSubscription saved = persistAsCurrent(subscription, "PLAN_CHANGED",
                "الباقة: " + (previous != null ? previous.getPlan().getCode() : "—") + " ← " + plan.getCode());

        billingService.issueFor(saved, saved.getCurrentPeriodStart(), saved.getCurrentPeriodEnd());
        return saved;
    }

    /**
     * Extends the current period in place. Used for renewals and for goodwill extensions.
     *
     * <p>Extension always lands on the period the tenant is actually living in. The old code chose
     * between {@code trialEndsAt} and {@code subscriptionEndsAt} from a heuristic over two fields
     * that could disagree, so an ACTIVE tenant still holding the TRIAL plan had its extension
     * written to a date nothing read — leaving it effectively unexpiring.
     */
    public TenantSubscription extend(Long tenantId, int days, boolean invoice, String note) {
        if (days <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "days must be positive");
        }
        TenantSubscription subscription = requireCurrent(tenantId);
        if (subscription.isPerpetual()) {
            return subscription;
        }
        Instant now = Instant.now();
        Instant base = subscription.getCurrentPeriodEnd().isAfter(now) ? subscription.getCurrentPeriodEnd() : now;
        Instant newEnd = base.plus(Duration.ofDays(days));

        Instant periodStart = subscription.getCurrentPeriodEnd();
        subscription.setCurrentPeriodEnd(newEnd);
        subscription.setGraceEndsAt(null);
        subscription.setLastWarningDays(null);
        if (!subscription.getStatus().isLive()) {
            subscription.setStatus(SubscriptionStatus.ACTIVE);
        } else if (subscription.getStatus() == SubscriptionStatus.GRACE) {
            subscription.setStatus(SubscriptionStatus.ACTIVE);
        }
        subscription.setNotes(note);

        TenantSubscription saved = save(subscription, "SUBSCRIPTION_EXTENDED", "تمديد " + days + " يوم");
        if (invoice) {
            billingService.issueFor(saved, periodStart, newEnd);
        }
        return saved;
    }

    /** Renew for one more billing period at the plan's current price, raising an invoice. */
    public TenantSubscription renew(Long tenantId) {
        TenantSubscription subscription = requireCurrent(tenantId);
        return extend(tenantId, subscription.getPlan().getBillingPeriodDays(), true, "تجديد الاشتراك");
    }

    public TenantSubscription applyOverrides(Long tenantId, QuotaOverrides overrides) {
        TenantSubscription subscription = requireCurrent(tenantId);
        applyOverrides(subscription, overrides, subscription.getPlan());
        return save(subscription, "QUOTAS_OVERRIDDEN", describeOverrides(subscription));
    }

    public TenantSubscription setGraceDays(Long tenantId, Integer graceDays) {
        TenantSubscription subscription = requireCurrent(tenantId);
        if (graceDays != null && (graceDays < 0 || graceDays > 90)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "graceDays must be between 0 and 90");
        }
        subscription.setGraceDays(graceDays);
        subscription.setGraceEndsAt(null);
        return save(subscription, "GRACE_UPDATED", "مهلة السماح: " + (graceDays == null ? "الافتراضي" : graceDays + " يوم"));
    }

    public TenantSubscription cancel(Long tenantId, String reason) {
        TenantSubscription subscription = requireCurrent(tenantId);
        subscription.setStatus(SubscriptionStatus.CANCELLED);
        subscription.setCancelledAt(Instant.now());
        subscription.setCancelReason(reason);
        subscription.setAutoRenew(false);
        return save(subscription, "SUBSCRIPTION_CANCELLED", reason != null ? reason : "تم إلغاء الاشتراك");
    }

    public void suspend(Long tenantId, String reason) {
        Tenant tenant = requireTenant(tenantId);
        tenant.setStatus(TenantStatus.SUSPENDED);
        tenantRepository.save(tenant);
        currentFor(tenantId).ifPresent(subscription -> {
            subscription.setStatus(SubscriptionStatus.SUSPENDED);
            subscriptionRepository.save(subscription);
        });
        audit(tenantId, "SUSPENDED", reason != null ? reason : "تم إيقاف الحساب");
        entitlementService.invalidate(tenantId);
    }

    public void resume(Long tenantId) {
        TenantSubscription subscription = requireCurrent(tenantId);
        // Recompute rather than assume ACTIVE: a subscription suspended while already lapsed must
        // come back lapsed, not silently gain a free period.
        subscription.setStatus(recomputeStatus(subscription, Instant.now()));
        save(subscription, "RESUMED", "تمت إعادة تفعيل الحساب");
    }

    /**
     * Installs the subscription a licence key just bought.
     *
     * <p>The period is counted from redemption using the key's own {@code durationDays}. It is not
     * taken from the key's expiry date, which is only a redemption deadline — conflating the two is
     * what used to hand a customer who redeemed a 365-day key in month eleven a six-week
     * subscription.
     */
    public TenantSubscription activateFromLicense(Long tenantId, Plan plan, int durationDays,
                                                  java.math.BigDecimal price, Long licenseKeyId, String keyLabel) {
        Instant now = Instant.now();
        TenantSubscription previous = currentFor(tenantId).orElse(null);
        Instant base = previous != null && previous.getCurrentPeriodEnd() != null
                && previous.getCurrentPeriodEnd().isAfter(now) && previous.getStatus().isLive()
                ? previous.getCurrentPeriodEnd() : now;

        TenantSubscription subscription = new TenantSubscription();
        subscription.setTenantId(tenantId);
        subscription.setPlan(plan);
        subscription.setStatus(SubscriptionStatus.ACTIVE);
        subscription.setSource(SubscriptionSource.LICENSE_KEY);
        subscription.setStartedAt(now);
        subscription.setCurrentPeriodStart(now);
        subscription.setCurrentPeriodEnd(durationDays > 0 ? base.plus(Duration.ofDays(durationDays)) : null);
        subscription.setPriceAtPurchase(price != null ? price : plan.getPrice());
        subscription.setCurrency(plan.getCurrency());
        subscription.setLicenseKeyId(licenseKeyId);
        subscription.setNotes("License " + keyLabel);

        return persistAsCurrent(subscription, "LICENSE_ACTIVATED",
                "تم تفعيل المفتاح " + keyLabel + " للباقة " + plan.getDisplayNameAr()
                        + (durationDays > 0 ? " لمدة " + durationDays + " يوم" : " (مدى الحياة)"));
    }

    // ── Internals ───────────────────────────────────────────────────────────

    /** Per-tenant quota deviations. Null fields mean "inherit the plan". */
    public record QuotaOverrides(Integer maxTables, Integer maxUsers, Integer maxProducts) {
        public boolean isEmpty() {
            return maxTables == null && maxUsers == null && maxProducts == null;
        }
    }

    private void applyOverrides(TenantSubscription subscription, QuotaOverrides overrides, Plan plan) {
        if (overrides == null) {
            subscription.setOverrideMaxTables(null);
            subscription.setOverrideMaxUsers(null);
            subscription.setOverrideMaxProducts(null);
            return;
        }
        subscription.setOverrideMaxTables(validateLimit("maxTables", overrides.maxTables()));
        subscription.setOverrideMaxUsers(validateLimit("maxUsers", overrides.maxUsers()));
        subscription.setOverrideMaxProducts(validateLimit("maxProducts", overrides.maxProducts()));
        if (plan.isCustomPlan() && overrides.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "A CUSTOM plan needs explicit limits — it has no defaults of its own");
        }
    }

    /** Accepts {@link QuotaType#UNLIMITED} (-1) and any positive ceiling; rejects 0 and nonsense. */
    private Integer validateLimit(String field, Integer value) {
        if (value == null) return null;
        if (value == QuotaType.UNLIMITED) return value;
        if (value < 1 || value > 100_000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    field + " must be -1 (unlimited) or between 1 and 100000");
        }
        return value;
    }

    /** Retires whatever is current and installs this one, preserving the history. */
    private TenantSubscription persistAsCurrent(TenantSubscription subscription, String action, String details) {
        subscriptionRepository.findByTenantIdAndCurrentTrue(subscription.getTenantId())
                .ifPresent(previous -> {
                    previous.setCurrent(false);
                    if (previous.getStatus().isLive()) {
                        previous.setStatus(SubscriptionStatus.CANCELLED);
                        previous.setCancelledAt(Instant.now());
                        previous.setCancelReason("Superseded");
                    }
                    subscriptionRepository.save(previous);
                });
        subscription.setCurrent(true);
        TenantSubscription saved = subscriptionRepository.save(subscription);
        syncTenant(saved);
        audit(saved.getTenantId(), action, details);
        entitlementService.invalidate(saved.getTenantId());
        return saved;
    }

    private TenantSubscription save(TenantSubscription subscription, String action, String details) {
        TenantSubscription saved = subscriptionRepository.save(subscription);
        syncTenant(saved);
        audit(saved.getTenantId(), action, details);
        entitlementService.invalidate(saved.getTenantId());
        return saved;
    }

    SubscriptionStatus recomputeStatus(TenantSubscription subscription, Instant now) {
        if (subscription.getStatus() == SubscriptionStatus.CANCELLED) return SubscriptionStatus.CANCELLED;
        Instant periodEnd = subscription.getCurrentPeriodEnd();
        if (periodEnd == null || now.isBefore(periodEnd)) {
            return subscription.getPriceAtPurchase().compareTo(BigDecimal.ZERO) == 0
                    && subscription.getSource() == SubscriptionSource.TRIAL_SIGNUP
                    ? SubscriptionStatus.TRIALING : SubscriptionStatus.ACTIVE;
        }
        Instant graceEnd = entitlementService.graceDeadline(subscription);
        return graceEnd != null && now.isBefore(graceEnd) ? SubscriptionStatus.GRACE : SubscriptionStatus.EXPIRED;
    }

    /** Mirrors the billing state onto the legacy tenant columns so older readers stay correct. */
    void syncTenant(TenantSubscription subscription) {
        Tenant tenant = tenantRepository.findById(subscription.getTenantId()).orElse(null);
        if (tenant == null) return;
        if (tenant.getStatus() == TenantStatus.SUSPENDED
                && subscription.getStatus() != SubscriptionStatus.SUSPENDED) {
            return; // a platform suspension is only lifted through resume()
        }
        tenant.setStatus(switch (subscription.getStatus()) {
            case TRIALING -> TenantStatus.TRIAL;
            case ACTIVE -> TenantStatus.ACTIVE;
            case GRACE -> TenantStatus.GRACE;
            case EXPIRED -> TenantStatus.EXPIRED;
            case SUSPENDED -> TenantStatus.SUSPENDED;
            case CANCELLED -> TenantStatus.CANCELLED;
        });
        tenantRepository.save(tenant);
    }

    private String describeOverrides(TenantSubscription subscription) {
        return "الحدود: طاولات=" + subscription.effectiveLimit(QuotaType.TABLES)
                + "، مستخدمين=" + subscription.effectiveLimit(QuotaType.USERS)
                + "، أصناف=" + subscription.effectiveLimit(QuotaType.PRODUCTS);
    }

    private Plan requirePlan(String code) {
        Plan plan = planRepository.findByCode(code)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Unknown plan: " + code));
        if (!plan.isActive()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Plan is retired and cannot be sold: " + code);
        }
        return plan;
    }

    private Tenant requireTenant(Long tenantId) {
        return tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tenant not found: " + tenantId));
    }

    public void audit(Long tenantId, String action, String details) {
        try {
            TenantActivityLog entry = new TenantActivityLog();
            entry.setTenantId(tenantId);
            entry.setAction(action);
            entry.setDetails(details);
            entry.setPerformedBy(CurrentActor.name());
            activityLogRepository.save(entry);
        } catch (RuntimeException failure) {
            log.warn("Could not record '{}' for tenant {}", action, tenantId, failure);
        }
    }
}
