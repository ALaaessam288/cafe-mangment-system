package com.example.cafemangmentsystem.tenant.platform;

import com.example.cafemangmentsystem.billing.SubscriptionService;
import com.example.cafemangmentsystem.billing.TenantUsageService;
import com.example.cafemangmentsystem.billing.dto.SubscriptionDto;
import com.example.cafemangmentsystem.billing.dto.TenantUsageDto;
import com.example.cafemangmentsystem.billing.entity.SubscriptionSource;
import com.example.cafemangmentsystem.tenant.TenantService;
import com.example.cafemangmentsystem.tenant.dto.TenantResponse;
import com.example.cafemangmentsystem.tenant.entity.TenantActivityLog;
import com.example.cafemangmentsystem.tenant.platform.dto.ProvisionTenantRequest;
import com.example.cafemangmentsystem.tenant.platform.dto.ProvisionTenantResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * The platform owner's control surface over a tenant's commercial terms.
 *
 * <p>The previous version offered three overlapping ways to change a subscription
 * ({@code /subscription}, {@code /quotas}, {@code /customize-plan}) whose effects on quotas
 * contradicted each other. Each verb here now maps to exactly one operation on
 * {@link SubscriptionService}, and quota deviations are a single explicit concept — overrides.
 */
@RestController
@RequestMapping("/api/admin/tenants")
@RequiredArgsConstructor
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class PlatformAdminController {

    private final TenantService tenantService;
    private final SubscriptionService subscriptionService;
    private final TenantUsageService usageService;

    // ── Tenants ─────────────────────────────────────────────────────────────

    /**
     * The full tenant list. Kept for exports and bulk selection, which genuinely need every row.
     * Screens that only display a page should call {@link #searchTenants} instead.
     */
    @GetMapping
    public List<TenantResponse> listAllTenants() {
        return tenantService.findAllTenants();
    }

    /** Paged, filtered, sorted tenant search for the console table. */
    @GetMapping("/search")
    public org.springframework.data.domain.Page<TenantResponse> searchTenants(
            @RequestParam(name = "query", required = false) String query,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "25") int size,
            @RequestParam(name = "sortBy", defaultValue = "name") String sortBy,
            @RequestParam(name = "direction", defaultValue = "asc") String direction) {
        return tenantService.searchTenants(query, page, size, sortBy, direction);
    }

    /**
     * Operator-driven provisioning.
     *
     * <p>{@code planCode} is required <em>here</em>, unlike public signup where its absence
     * legitimately means "the free trial". An operator provisioning a customer has always chosen a
     * plan; a missing code means the client failed to send it, and silently defaulting to the trial
     * is how a customer who paid for ENTERPRISE ended up with fourteen days. Fail loudly instead.
     */
    @PostMapping("/provision")
    public ProvisionTenantResponse provisionTenant(@Valid @RequestBody ProvisionTenantRequest request) {
        if (request.planCode() == null || request.planCode().isBlank()) {
            throw new org.springframework.web.server.ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "planCode is required when provisioning from the platform console");
        }
        return tenantService.provisionWithSetup(request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTenant(@PathVariable Long id) {
        tenantService.deleteTenant(id);
    }

    @GetMapping("/stats")
    public Map<String, Object> getPlatformStats() {
        return tenantService.getPlatformStats();
    }

    /** Counts and limits for one tenant, counted in that tenant's own scope. */
    @GetMapping("/{id}/usage")
    public TenantUsageDto getTenantUsage(@PathVariable Long id) {
        return usageService.forTenant(id);
    }

    @GetMapping("/{id}/activity-log")
    public List<TenantActivityLog> getActivityLogs(@PathVariable Long id) {
        return tenantService.getTenantActivityLogs(id);
    }

    @GetMapping("/activity-log")
    public List<TenantActivityLog> getPlatformActivityLogs() {
        return tenantService.getPlatformActivityLogs();
    }

    /**
     * Audit search across every tenant.
     *
     * <p>The console used to filter the newest 200 rows in the browser, so its search box could not
     * reach anything older and did not say so.
     */
    @GetMapping("/activity-log/search")
    public org.springframework.data.domain.Page<TenantActivityLog> searchActivityLogs(
            @RequestParam(name = "tenantId", required = false) Long tenantId,
            @RequestParam(name = "action", required = false) String action,
            @RequestParam(name = "from", required = false)
            @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE_TIME)
            java.time.Instant from,
            @RequestParam(name = "to", required = false)
            @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE_TIME)
            java.time.Instant to,
            @RequestParam(name = "query", required = false) String query,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "50") int size) {
        return tenantService.searchActivityLogs(tenantId, action, from, to, query, page, size);
    }

    /** Action codes actually present in the log, for the filter dropdown. */
    @GetMapping("/activity-log/actions")
    public List<String> activityActions() {
        return tenantService.knownActivityActions();
    }

    public record SettingsRequest(Integer serviceChargePercent, Boolean whatsappAlertsEnabled) {}

    /** Tenant preferences, deliberately separate from the commercial terms below. */
    @PutMapping("/{id}/settings")
    public TenantResponse updateSettings(@PathVariable Long id, @RequestBody SettingsRequest request) {
        return tenantService.updateSettings(id, request.serviceChargePercent(),
                request.whatsappAlertsEnabled());
    }

    // ── Subscription ────────────────────────────────────────────────────────

    @GetMapping("/{id}/subscription")
    public SubscriptionDto subscription(@PathVariable Long id) {
        return SubscriptionDto.from(subscriptionService.requireCurrent(id));
    }

    @GetMapping("/{id}/subscription/history")
    public List<SubscriptionDto> subscriptionHistory(@PathVariable Long id) {
        return subscriptionService.historyFor(id).stream().map(SubscriptionDto::from).toList();
    }

    /**
     * Moves the tenant onto a plan, opening a fresh period and invoicing it.
     *
     * <p>{@code overrides} is all-or-nothing on purpose: sending none means "use the plan's limits",
     * which correctly discards a previous bespoke deal instead of leaving stale numbers behind.
     */
    public record ChangePlanRequest(
            String planCode,
            Integer periodDays,
            BigDecimal negotiatedPrice,
            Integer maxTables,
            Integer maxUsers,
            Integer maxProducts,
            String note
    ) {
        SubscriptionService.QuotaOverrides overrides() {
            if (maxTables == null && maxUsers == null && maxProducts == null) return null;
            return new SubscriptionService.QuotaOverrides(maxTables, maxUsers, maxProducts);
        }
    }

    @PutMapping("/{id}/subscription/plan")
    public SubscriptionDto changePlan(@PathVariable Long id, @RequestBody ChangePlanRequest request) {
        return SubscriptionDto.from(subscriptionService.changePlan(
                id, request.planCode(), request.periodDays(), request.negotiatedPrice(),
                SubscriptionSource.MANUAL_ADMIN, request.overrides(), request.note()));
    }

    public record ExtendRequest(Integer days, Boolean invoice, String note) {}

    @PostMapping("/{id}/subscription/extend")
    public SubscriptionDto extend(@PathVariable Long id, @RequestBody ExtendRequest request) {
        return SubscriptionDto.from(subscriptionService.extend(
                id, request.days() == null ? 0 : request.days(),
                Boolean.TRUE.equals(request.invoice()), request.note()));
    }

    @PostMapping("/{id}/subscription/renew")
    public SubscriptionDto renew(@PathVariable Long id) {
        return SubscriptionDto.from(subscriptionService.renew(id));
    }

    public record OverridesRequest(Integer maxTables, Integer maxUsers, Integer maxProducts) {}

    /** Bespoke limits for this tenant. {@code -1} means unlimited; null clears the override. */
    @PutMapping("/{id}/subscription/overrides")
    public SubscriptionDto overrides(@PathVariable Long id, @RequestBody OverridesRequest request) {
        return SubscriptionDto.from(subscriptionService.applyOverrides(id,
                new SubscriptionService.QuotaOverrides(
                        request.maxTables(), request.maxUsers(), request.maxProducts())));
    }

    public record GraceRequest(Integer graceDays) {}

    @PutMapping("/{id}/subscription/grace")
    public SubscriptionDto grace(@PathVariable Long id, @RequestBody GraceRequest request) {
        return SubscriptionDto.from(subscriptionService.setGraceDays(id, request.graceDays()));
    }

    public record ReasonRequest(String reason) {}

    @PostMapping("/{id}/subscription/cancel")
    public SubscriptionDto cancel(@PathVariable Long id, @RequestBody(required = false) ReasonRequest request) {
        return SubscriptionDto.from(subscriptionService.cancel(id, request != null ? request.reason() : null));
    }

    @PostMapping("/{id}/suspend")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void suspend(@PathVariable Long id, @RequestBody(required = false) ReasonRequest request) {
        subscriptionService.suspend(id, request != null ? request.reason() : null);
    }

    @PostMapping("/{id}/resume")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resume(@PathVariable Long id) {
        subscriptionService.resume(id);
    }
}
