package com.example.cafemangmentsystem.billing;

import com.example.cafemangmentsystem.billing.entity.Feature;
import com.example.cafemangmentsystem.billing.entity.Plan;
import com.example.cafemangmentsystem.billing.entity.QuotaType;

import com.example.cafemangmentsystem.billing.repository.PlanRepository;
import com.example.cafemangmentsystem.billing.repository.TenantSubscriptionRepository;
import com.example.cafemangmentsystem.tenant.entity.Tenant;
import com.example.cafemangmentsystem.tenant.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.EnumSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Seeds the plan catalogue and gives every tenant an opening subscription.
 *
 * <p>Runs on both deployment paths: on Postgres the same rows arrive via Flyway V3 and this is a
 * no-op, while the packaged desktop build has no Flyway at all and needs them created here.
 * Everything is keyed on the plan code and guarded by an existence check, so it is safe to run on
 * every boot.
 *
 * <p>It only ever inserts. An operator who edits PRO's price through the admin API must not have
 * that edit reverted the next time the process restarts.
 */
@Component
@RequiredArgsConstructor
@Order(0)
@Slf4j
public class PlanCatalogueSeeder implements ApplicationRunner {

    private final PlanRepository planRepository;
    private final TenantRepository tenantRepository;
    private final TenantSubscriptionRepository subscriptionRepository;
    private final SubscriptionService subscriptionService;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        seedPlans();
        backfillSubscriptions();
    }

    private void seedPlans() {
        // The limits below are the ones the server has always enforced. Where the frontend's
        // hardcoded pricing cards disagreed with them, the server's numbers are the real terms
        // customers were sold under, so those are what carry over.
        upsert("TRIAL", "فترة تجريبية", "Free trial", BigDecimal.ZERO, 14, 14,
                5, 2, 30, EnumSet.of(Feature.POS, Feature.THERMAL_PRINT), 0, true, false);

        upsert("STARTER", "الباقة الأساسية", "Starter", new BigDecimal("499.00"), 30, 0,
                20, 5, 100,
                EnumSet.of(Feature.POS, Feature.THERMAL_PRINT, Feature.EXPENSES, Feature.DISCOUNTS),
                1, false, false);

        upsert("PRO", "الباقة الاحترافية", "Professional", new BigDecimal("899.00"), 30, 0,
                50, 15, 500,
                EnumSet.of(Feature.POS, Feature.THERMAL_PRINT, Feature.EXPENSES, Feature.DISCOUNTS,
                        Feature.KDS, Feature.DEBTS, Feature.INVENTORY, Feature.PAYROLL,
                        Feature.REPORTS, Feature.MULTI_REGISTER, Feature.MANAGER_OVERRIDE,
                        Feature.WHATSAPP_ALERTS),
                2, false, false);

        upsert("ENTERPRISE", "الباقة الشاملة", "Enterprise", new BigDecimal("1499.00"), 30, 0,
                QuotaType.UNLIMITED, QuotaType.UNLIMITED, QuotaType.UNLIMITED,
                EnumSet.allOf(Feature.class), 3, false, false);

        // A shell for negotiated deals. Its limits are meaningless — every CUSTOM subscription must
        // carry explicit overrides, which SubscriptionService enforces.
        upsert("CUSTOM", "باقة مخصصة", "Custom", BigDecimal.ZERO, 30, 0,
                1, 1, 1, EnumSet.allOf(Feature.class), 4, false, true);
    }

    private void upsert(String code, String nameAr, String nameEn, BigDecimal price, int periodDays,
                        int trialDays, int maxTables, int maxUsers, int maxProducts,
                        Set<Feature> features, int sortOrder, boolean selfSelectable, boolean custom) {
        if (planRepository.existsByCode(code)) return;

        Plan plan = new Plan();
        plan.setCode(code);
        plan.setDisplayNameAr(nameAr);
        plan.setDisplayNameEn(nameEn);
        plan.setPrice(price);
        plan.setCurrency("EGP");
        plan.setBillingPeriodDays(periodDays);
        plan.setTrialDays(trialDays);
        plan.setMaxTables(maxTables);
        plan.setMaxUsers(maxUsers);
        plan.setMaxProducts(maxProducts);
        plan.setFeatures(new LinkedHashSet<>(features));
        plan.setSortOrder(sortOrder);
        plan.setActive(true);
        plan.setSelfSelectable(selfSelectable);
        plan.setCustomPlan(custom);
        planRepository.save(plan);
        log.info("[BILLING] Seeded plan {}", code);
    }

    /**
     * Gives any tenant without a current subscription one, so an existing installation upgrading to
     * this version does not wake up with every café locked out for having no entitlements.
     */
    private void backfillSubscriptions() {
        List<Tenant> tenants = tenantRepository.findAll();
        for (Tenant tenant : tenants) {
            if ("platform".equalsIgnoreCase(tenant.getSlug())) continue;
            if (subscriptionRepository.findByTenantIdAndCurrentTrue(tenant.getId()).isPresent()) continue;

            planRepository.findByCode("TRIAL").ifPresent(trial -> {
                subscriptionService.startTrial(tenant.getId(), trial);
                log.info("[BILLING] Opened a trial subscription for existing tenant {}", tenant.getSlug());
            });
        }
    }
}
