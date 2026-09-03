package com.example.cafemangmentsystem.billing;

import com.example.cafemangmentsystem.billing.entity.SubscriptionStatus;
import com.example.cafemangmentsystem.billing.entity.TenantSubscription;
import com.example.cafemangmentsystem.billing.repository.TenantSubscriptionRepository;
import com.example.cafemangmentsystem.common.whatsapp.WhatsAppService;
import com.example.cafemangmentsystem.tenant.entity.Tenant;
import com.example.cafemangmentsystem.tenant.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;

/**
 * Advances subscriptions through the lifecycle and warns owners before they are locked out.
 *
 * <p>The codebase previously contained no scheduled work at all: nothing ever moved a tenant out of
 * ACTIVE, so platform statistics counted long-dead accounts as customers, and the first a café
 * owner knew about an expiry was a cashier's failed sale. Expiry itself is still evaluated live on
 * every request by {@link EntitlementService} — this job persists the transition and does the
 * things a request cannot: notify, and keep reporting honest.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "app.billing", name = "scheduler-enabled", havingValue = "true", matchIfMissing = true)
@Slf4j
public class SubscriptionExpiryJob {

    private final TenantSubscriptionRepository subscriptionRepository;
    private final TenantRepository tenantRepository;
    private final SubscriptionService subscriptionService;
    private final EntitlementService entitlementService;
    private final WhatsAppService whatsAppService;
    private final BillingProperties properties;

    /** Hourly is enough: grace is measured in days, and access checks never wait for this job. */
    @Scheduled(fixedDelayString = "${app.billing.scheduler-interval-ms:3600000}", initialDelay = 60_000)
    @Transactional
    public void run() {
        Instant now = Instant.now();
        try {
            advanceLapsed(now);
            warnUpcoming(now);
        } catch (RuntimeException failure) {
            // Never let a bad row stop the next run.
            log.error("Subscription maintenance pass failed", failure);
        }
    }

    private void advanceLapsed(Instant now) {
        List<TenantSubscription> lapsed = subscriptionRepository.findLapsed(now);
        for (TenantSubscription subscription : lapsed) {
            SubscriptionStatus before = subscription.getStatus();
            SubscriptionStatus after = subscriptionService.recomputeStatus(subscription, now);
            if (before == after) continue;

            if (after == SubscriptionStatus.GRACE && subscription.getGraceEndsAt() == null) {
                subscription.setGraceEndsAt(entitlementService.graceDeadline(subscription));
            }
            subscription.setStatus(after);
            subscriptionRepository.save(subscription);
            subscriptionService.syncTenant(subscription);
            entitlementService.invalidate(subscription.getTenantId());

            if (after == SubscriptionStatus.GRACE) {
                long graceDays = subscription.getGraceEndsAt() == null ? 0
                        : Math.max(0, Duration.between(now, subscription.getGraceEndsAt()).toDays());
                subscriptionService.audit(subscription.getTenantId(), "SUBSCRIPTION_GRACE",
                        "انتهت الفترة، بدأت مهلة السماح (" + graceDays + " يوم)");
                notifyOwner(subscription, "انتهى اشتراكك في كافيو. لديك مهلة " + graceDays
                        + " يوم لتجديد الاشتراك قبل إيقاف الكتابة على الحساب.");
            } else if (after == SubscriptionStatus.EXPIRED) {
                subscriptionService.audit(subscription.getTenantId(), "SUBSCRIPTION_EXPIRED",
                        "انتهت مهلة السماح، الحساب للقراءة فقط");
                notifyOwner(subscription, "انتهت مهلة السماح لاشتراك كافيو. الحساب الآن للقراءة فقط — "
                        + "يرجى التجديد أو تفعيل مفتاح ترخيص لاستئناف العمل.");
            }
        }
    }

    /**
     * Sends at most one warning per threshold per period. {@code lastWarningDays} records the
     * highest threshold already used, so a tenant gets 7-day, 3-day and 1-day notices once each
     * rather than one every hour.
     */
    private void warnUpcoming(Instant now) {
        List<Integer> thresholds = properties.getWarningDays().stream()
                .sorted(Comparator.reverseOrder())
                .toList();
        if (thresholds.isEmpty()) return;

        Instant horizon = now.plus(Duration.ofDays(thresholds.get(0)));
        for (TenantSubscription subscription : subscriptionRepository.findExpiringBefore(now, horizon)) {
            long daysLeft = Duration.between(now, subscription.getCurrentPeriodEnd()).toDays();

            Integer threshold = thresholds.stream()
                    .filter(candidate -> daysLeft <= candidate)
                    .min(Comparator.naturalOrder())
                    .orElse(null);
            if (threshold == null) continue;

            Integer alreadySent = subscription.getLastWarningDays();
            if (alreadySent != null && alreadySent <= threshold) continue;

            subscription.setLastWarningDays(threshold);
            subscriptionRepository.save(subscription);

            String noun = subscription.getStatus() == SubscriptionStatus.TRIALING ? "الفترة التجريبية" : "اشتراكك";
            notifyOwner(subscription, "تنبيه: " + noun + " في كافيو ينتهي خلال "
                    + Math.max(1, daysLeft) + " يوم. يرجى التجديد لتفادي توقف الخدمة.");
        }
    }

    private void notifyOwner(TenantSubscription subscription, String message) {
        Tenant tenant = tenantRepository.findById(subscription.getTenantId()).orElse(null);
        if (tenant == null || !Boolean.TRUE.equals(tenant.getWhatsappAlertsEnabled())) return;
        String number = tenant.getOwnerWhatsapp();
        if (number == null || number.isBlank()) return;
        try {
            whatsAppService.sendInstantMessage(number, message);
        } catch (RuntimeException failure) {
            // A gateway outage must never block the lifecycle transition it was reporting.
            log.warn("Could not notify tenant {} about its subscription", subscription.getTenantId(), failure);
        }
    }
}
