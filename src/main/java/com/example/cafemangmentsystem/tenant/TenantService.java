package com.example.cafemangmentsystem.tenant;

import com.example.cafemangmentsystem.billing.BillingService;
import com.example.cafemangmentsystem.billing.EntitlementService;
import com.example.cafemangmentsystem.billing.PlanService;
import com.example.cafemangmentsystem.billing.SubscriptionService;
import com.example.cafemangmentsystem.billing.entity.Plan;
import com.example.cafemangmentsystem.billing.entity.QuotaType;
import com.example.cafemangmentsystem.billing.entity.SubscriptionSource;
import com.example.cafemangmentsystem.billing.entity.SubscriptionStatus;
import com.example.cafemangmentsystem.billing.entity.TenantSubscription;
import com.example.cafemangmentsystem.billing.repository.TenantSubscriptionRepository;
import com.example.cafemangmentsystem.common.tenant.CurrentActor;
import com.example.cafemangmentsystem.common.tenant.TenantContext;
import com.example.cafemangmentsystem.security.UserPrincipal;
import com.example.cafemangmentsystem.security.jwt.JwtService;
import com.example.cafemangmentsystem.tenant.dto.PublicTenantDto;
import com.example.cafemangmentsystem.tenant.dto.TenantResponse;
import com.example.cafemangmentsystem.tenant.entity.Tenant;
import com.example.cafemangmentsystem.tenant.entity.TenantActivityLog;
import com.example.cafemangmentsystem.tenant.entity.TenantStatus;
import com.example.cafemangmentsystem.tenant.platform.TenantOwnerProvisioner;
import com.example.cafemangmentsystem.tenant.platform.TenantSaver;
import com.example.cafemangmentsystem.tenant.platform.dto.ProvisionTenantRequest;
import com.example.cafemangmentsystem.tenant.platform.dto.ProvisionTenantResponse;
import com.example.cafemangmentsystem.tenant.repository.TenantActivityLogRepository;
import com.example.cafemangmentsystem.tenant.repository.TenantRepository;
import com.example.cafemangmentsystem.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Tenant identity and provisioning.
 *
 * <p>Everything to do with what a tenant is entitled to has moved out of this class. Plan changes,
 * quotas, extensions, cancellation and expiry belong to {@link SubscriptionService}; usage belongs
 * to {@code TenantUsageService}. This class had accumulated three mutually inconsistent ways to
 * change a plan, and that inconsistency was the source of most of the subscription defects.
 */
@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class TenantService {

    /**
     * Statuses that may authenticate. A lapsed tenant must still be able to log in — read-only
     * access, and above all the ability to pay, is the only way out of the state.
     */
    private static final Set<TenantStatus> LOGINABLE = Set.of(
            TenantStatus.TRIAL, TenantStatus.ACTIVE, TenantStatus.GRACE, TenantStatus.EXPIRED);

    private final TenantRepository tenantRepository;
    private final TenantOwnerProvisioner tenantOwnerProvisioner;
    private final TenantSaver tenantSaver;
    private final JwtService jwtService;
    private final TenantActivityLogRepository tenantActivityLogRepository;
    private final TenantSubscriptionRepository subscriptionRepository;
    private final SubscriptionService subscriptionService;
    private final PlanService planService;
    private final BillingService billingService;
    private final EntitlementService entitlementService;

    // ── Identity ────────────────────────────────────────────────────────────

    /**
     * Resolves a tenant for login. Deliberately throws the same {@link BadCredentialsException}
     * for "no such slug" and "tenant not loginable" as a wrong password would — AuthController's
     * handler turns that into a generic 401, so we never reveal which part was wrong.
     */
    @Transactional(readOnly = true)
    public Tenant resolveLoginableTenant(String slug) {
        Tenant tenant = tenantRepository.findBySlug(slug)
                .orElseThrow(() -> new BadCredentialsException("Unknown tenant"));
        if (!LOGINABLE.contains(tenant.getStatus())) {
            throw new BadCredentialsException("Tenant is not active");
        }
        return tenant;
    }

    @Transactional(readOnly = true)
    public TenantResponse findById(Long id) {
        Tenant tenant = requireTenant(id);
        return TenantResponse.from(tenant, currentSubscription(id));
    }

    @Transactional(readOnly = true)
    public List<PublicTenantDto> findAllPublic() {
        return tenantRepository.findAll().stream()
                .filter(t -> LOGINABLE.contains(t.getStatus()) && !isPlatform(t))
                .map(t -> new PublicTenantDto(t.getSlug(), t.getName(), t.getBusinessType().name()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<TenantResponse> findAllTenants() {
        return tenantRepository.findAll().stream()
                .filter(t -> !isPlatform(t))
                .map(t -> TenantResponse.from(t, currentSubscription(t.getId())))
                .toList();
    }

    public TenantResponse updateLogo(Long tenantId, String logoUrl) {
        Tenant tenant = requireTenant(tenantId);
        tenant.setLogoUrl(logoUrl);
        Tenant saved = tenantRepository.save(tenant);
        audit(tenantId, "LOGO_UPDATED", logoUrl != null ? "تم تحديث الشعار" : "تم حذف الشعار");
        return TenantResponse.from(saved, currentSubscription(tenantId));
    }

    /**
     * Tenant preferences the platform can set on the customer's behalf.
     *
     * <p>These travelled on the old {@code customize-plan} endpoint alongside the subscription,
     * which is why changing a service-charge percentage and changing a plan were the same call —
     * and why one of them could fail for reasons belonging to the other. They are settings, not
     * commercial terms, so they get their own verb.
     */
    public TenantResponse updateSettings(Long tenantId, Integer serviceChargePercent,
                                         Boolean whatsappAlertsEnabled) {
        Tenant tenant = requireTenant(tenantId);
        if (serviceChargePercent != null) {
            if (serviceChargePercent < 0 || serviceChargePercent > 100) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "serviceChargePercent must be between 0 and 100");
            }
            tenant.setServiceChargePercent(serviceChargePercent);
        }
        if (whatsappAlertsEnabled != null) {
            tenant.setWhatsappAlertsEnabled(whatsappAlertsEnabled);
        }
        Tenant saved = tenantRepository.save(tenant);
        audit(tenantId, "SETTINGS_UPDATED",
                "نسبة الخدمة: " + saved.getServiceChargePercent()
                        + "، تنبيهات واتساب: " + saved.getWhatsappAlertsEnabled());
        return TenantResponse.from(saved, currentSubscription(tenantId));
    }

    // ── Self-service plan selection ─────────────────────────────────────────

    /**
     * The onboarding modal's "choose your plan". Only plans flagged {@code selfSelectable} — in
     * practice the free trial — can be taken this way; a paid tier is a purchase and needs a licence
     * key or a platform admin. The rejection carries an Arabic message, because the modal renders
     * the server's message straight to the café owner, and used to show them raw English.
     */
    public TenantSubscription selectSelfServicePlan(Long tenantId, String planCode) {
        Tenant tenant = requireTenant(tenantId);
        Plan plan = planService.requireByCode(planCode);

        if (!plan.isSelfSelectable()) {
            throw new ResponseStatusException(HttpStatus.PAYMENT_REQUIRED,
                    "باقة \"" + plan.getDisplayNameAr() + "\" باقة مدفوعة. "
                            + "يرجى إدخال مفتاح الترخيص من صفحة الإعدادات أو التواصل مع فريق المبيعات لتفعيلها.");
        }

        TenantSubscription existing = currentSubscription(tenantId);
        if (existing != null && existing.getSource() != SubscriptionSource.TRIAL_SIGNUP) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "لا يمكن الرجوع إلى الباقة التجريبية بعد تفعيل اشتراك مدفوع.");
        }

        TenantSubscription subscription = existing != null
                ? existing
                : subscriptionService.startTrial(tenantId, plan);

        tenant.setPlanSelected(true);
        tenantRepository.save(tenant);
        audit(tenantId, "PLAN_SELECTED", "اختار المستخدم باقة " + plan.getDisplayNameAr());
        entitlementService.invalidate(tenantId);
        return subscription;
    }

    // ── Provisioning ────────────────────────────────────────────────────────

    /** Public trial registration. Forces the trial plan regardless of what the caller asked for. */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public ProvisionTenantResponse registerTrialTenant(ProvisionTenantRequest request) {
        return provisionWithSetup(request.withPlanCode(defaultTrialPlan().getCode()));
    }

    /**
     * Provisions a new tenant, its owner user, and its opening subscription.
     *
     * <p>SQLite is single-writer, so this runs with NOT_SUPPORTED and each step commits before the
     * next opens a connection. If owner creation fails, the committed tenant shell is removed in a
     * compensating transaction so the slug stays retryable.
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public ProvisionTenantResponse provisionWithSetup(ProvisionTenantRequest request) {
        String slug = request.slug().trim().toLowerCase(Locale.ROOT);
        String timezone = blankTo(request.timezone(), "Africa/Cairo");
        String currency = blankTo(request.currency(), "EGP");
        validateTimezone(timezone);
        validateCurrency(currency);

        if (tenantSaver.existsBySlug(slug)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Slug already taken: " + slug);
        }

        Plan plan = request.planCode() == null || request.planCode().isBlank()
                ? defaultTrialPlan()
                : planService.requireByCode(request.planCode());

        int defaultTables = request.defaultTables() != null ? request.defaultTables() : 5;
        int tableLimit = plan.getMaxTables();
        if (defaultTables < 0 || (!QuotaType.isUnlimited(tableLimit) && defaultTables > tableLimit)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "defaultTables must be between 0 and the selected plan limit of " + tableLimit);
        }

        Tenant tenant = new Tenant();
        tenant.setName(request.name().trim());
        tenant.setSlug(slug);
        tenant.setBusinessType(request.businessType());
        tenant.setStatus(plan.getTrialDays() > 0 ? TenantStatus.TRIAL : TenantStatus.ACTIVE);
        tenant.setPlanSelected(true);
        tenant.setOwnerWhatsapp(request.ownerWhatsapp() == null || request.ownerWhatsapp().isBlank()
                ? null : request.ownerWhatsapp().trim());
        tenant.setTimezone(timezone);
        tenant.setCurrency(currency);

        tenant = tenantSaver.save(tenant);

        User owner;
        TenantContext.set(tenant.getId());
        try {
            owner = tenantOwnerProvisioner.createOwner(
                    request.ownerUsername().trim(), request.ownerFullName().trim(), request.ownerPassword(),
                    defaultTables, request.templateId());
        } catch (RuntimeException provisioningFailure) {
            TenantContext.clear();
            try {
                tenantSaver.deleteById(tenant.getId());
            } catch (RuntimeException cleanupFailure) {
                provisioningFailure.addSuppressed(cleanupFailure);
                log.error("Failed to remove tenant shell {} after provisioning failure", tenant.getId(), cleanupFailure);
            }
            throw provisioningFailure;
        } finally {
            TenantContext.clear();
        }

        openingSubscription(tenant.getId(), plan);

        try {
            TenantActivityLog created = new TenantActivityLog();
            created.setTenantId(tenant.getId());
            created.setAction("CREATED");
            created.setDetails("تم إنشاء الحساب على باقة " + plan.getDisplayNameAr());
            created.setPerformedBy(request.ownerUsername());
            tenantActivityLogRepository.save(created);
        } catch (RuntimeException auditFailure) {
            // Audit logging must not turn a successfully provisioned tenant into a false failure.
            log.warn("Tenant {} was provisioned, but its CREATED audit event could not be recorded",
                    tenant.getId(), auditFailure);
        }

        String jwtToken = jwtService.generateToken(new UserPrincipal(owner));
        return new ProvisionTenantResponse(tenant.getId(), tenant.getSlug(), request.ownerUsername(), jwtToken);
    }

    /** A trial plan opens a trial; anything else opens a paid period and raises its first invoice. */
    private void openingSubscription(Long tenantId, Plan plan) {
        if (plan.getTrialDays() > 0 && plan.getPrice().compareTo(BigDecimal.ZERO) == 0) {
            subscriptionService.startTrial(tenantId, plan);
        } else {
            subscriptionService.changePlan(tenantId, plan.getCode(), null, null,
                    SubscriptionSource.MANUAL_ADMIN, null, "Opening subscription");
        }
    }

    private Plan defaultTrialPlan() {
        return planService.requireByCode("TRIAL");
    }

    // ── Platform reporting ──────────────────────────────────────────────────

    /**
     * Platform headline numbers.
     *
     * <p>Counted from live subscription state rather than the tenant's {@code status} column, which
     * nothing ever moved off ACTIVE — so a tenant that stopped paying a year ago was counted as an
     * active customer forever.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getPlatformStats() {
        List<Tenant> customers = tenantRepository.findAll().stream().filter(t -> !isPlatform(t)).toList();

        long trialing = 0, active = 0, grace = 0, expired = 0, suspended = 0, cancelled = 0;
        for (Tenant tenant : customers) {
            SubscriptionStatus status = entitlementService.forTenant(tenant.getId()).status();
            if (status == null) continue;
            switch (status) {
                case TRIALING -> trialing++;
                case ACTIVE -> active++;
                case GRACE -> grace++;
                case EXPIRED -> expired++;
                case SUSPENDED -> suspended++;
                case CANCELLED -> cancelled++;
            }
        }

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalTenants", customers.size());
        stats.put("trialTenants", trialing);
        stats.put("activeTenants", active);
        stats.put("graceTenants", grace);
        stats.put("expiredTenants", expired);
        stats.put("suspendedTenants", suspended);
        stats.put("cancelledTenants", cancelled);
        stats.put("payingTenants", active + grace);
        stats.putAll(billingService.revenueStats());
        return stats;
    }

    @Transactional(readOnly = true)
    public List<TenantActivityLog> getTenantActivityLogs(Long tenantId) {
        return tenantActivityLogRepository.findByTenantIdOrderByCreatedAtDesc(tenantId);
    }

    @Transactional(readOnly = true)
    public List<TenantActivityLog> getPlatformActivityLogs() {
        return tenantActivityLogRepository.findTop200ByOrderByCreatedAtDesc();
    }

    // ── Deletion ────────────────────────────────────────────────────────────

    /**
     * Removes a tenant and everything belonging to it.
     *
     * <p>The business data is removed by the database: every tenant-scoped table declares
     * {@code tenant_id … ON DELETE CASCADE}. The previous implementation deleted only users and
     * activity logs, leaving orders, products, tables, shifts, expenses and debts behind with a
     * dangling {@code tenant_id} — rows a future tenant reusing that id would have inherited.
     */
    @Transactional
    public void deleteTenant(Long tenantId) {
        Tenant tenant = requireTenant(tenantId);
        if (isPlatform(tenant)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot delete the master platform tenant");
        }
        subscriptionRepository.deleteAll(subscriptionRepository.findByTenantIdOrderByStartedAtDesc(tenantId));
        tenantActivityLogRepository.deleteAll(tenantActivityLogRepository.findByTenantIdOrderByCreatedAtDesc(tenantId));
        tenantRepository.delete(tenant);
        entitlementService.invalidate(tenantId);
        log.info("Tenant {} ({}) deleted by {}", tenantId, tenant.getSlug(), CurrentActor.name());
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private TenantSubscription currentSubscription(Long tenantId) {
        return subscriptionRepository.findByTenantIdAndCurrentTrue(tenantId).orElse(null);
    }

    private Tenant requireTenant(Long tenantId) {
        if (tenantId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No tenant in context");
        }
        return tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tenant not found: " + tenantId));
    }

    private boolean isPlatform(Tenant tenant) {
        return "platform".equalsIgnoreCase(tenant.getSlug());
    }

    private String blankTo(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private void validateTimezone(String timezone) {
        try {
            java.time.ZoneId.of(timezone);
        } catch (java.time.DateTimeException invalid) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported timezone: " + timezone);
        }
    }

    private void validateCurrency(String currency) {
        try {
            java.util.Currency.getInstance(currency);
        } catch (IllegalArgumentException invalid) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported currency: " + currency);
        }
    }

    private void audit(Long tenantId, String action, String details) {
        try {
            TenantActivityLog entry = new TenantActivityLog();
            entry.setTenantId(tenantId);
            entry.setAction(action);
            entry.setDetails(details);
            entry.setPerformedBy(CurrentActor.name());
            tenantActivityLogRepository.save(entry);
        } catch (RuntimeException failure) {
            log.warn("Could not record '{}' for tenant {}", action, tenantId, failure);
        }
    }
}
