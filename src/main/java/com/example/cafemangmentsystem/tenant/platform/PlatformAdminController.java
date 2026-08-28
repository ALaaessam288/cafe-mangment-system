package com.example.cafemangmentsystem.tenant.platform;

import com.example.cafemangmentsystem.tenant.TenantService;
import com.example.cafemangmentsystem.tenant.dto.TenantResponse;
import com.example.cafemangmentsystem.tenant.entity.SubscriptionPlan;
import com.example.cafemangmentsystem.tenant.entity.TenantStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/tenants")
@RequiredArgsConstructor
public class PlatformAdminController {

    private final TenantService tenantService;

    @GetMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    public List<TenantResponse> listAllTenants() {
        return tenantService.findAllTenants();
    }

    public record UpdateSubscriptionRequest(
            SubscriptionPlan plan,
            TenantStatus status,
            Integer extendDays
    ) {}

    @PostMapping("/provision")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    public com.example.cafemangmentsystem.tenant.platform.dto.ProvisionTenantResponse provisionTenant(@RequestBody com.example.cafemangmentsystem.tenant.platform.dto.ProvisionTenantRequest request) {
        return tenantService.provisionWithSetup(request);
    }

    @PutMapping("/{id}/subscription")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    public TenantResponse updateSubscription(@PathVariable Long id, @RequestBody UpdateSubscriptionRequest request) {
        return tenantService.updateTenantSubscription(id, request.plan(), request.status(), request.extendDays());
    }

    @GetMapping("/stats")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    public java.util.Map<String, Object> getPlatformStats() {
        return tenantService.getPlatformStats();
    }

    @GetMapping("/{id}/usage")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    public java.util.Map<String, Object> getTenantUsage(@PathVariable Long id) {
        return tenantService.getTenantUsage(id);
    }
    
    public record UpdateQuotasRequest(
            Integer maxTables,
            Integer maxUsers,
            Integer maxProducts
    ) {}

    @PutMapping("/{id}/quotas")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    public TenantResponse updateQuotas(@PathVariable Long id, @RequestBody UpdateQuotasRequest request) {
        return tenantService.updateQuotas(id, request.maxTables(), request.maxUsers(), request.maxProducts());
    }

    public record CustomizePlanRequest(
            SubscriptionPlan plan,
            TenantStatus status,
            Integer maxTables,
            Integer maxUsers,
            Integer maxProducts,
            Integer serviceChargePercent,
            Boolean whatsappAlertsEnabled,
            Integer extendDays,
            java.time.Instant subscriptionEndsAt,
            java.time.Instant trialEndsAt
    ) {}

    @PutMapping("/{id}/customize-plan")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    public TenantResponse customizePlan(@PathVariable Long id, @RequestBody CustomizePlanRequest request) {
        return tenantService.customizeTenantPlan(id, request);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void deleteTenant(@PathVariable Long id) {
        tenantService.deleteTenant(id);
    }

    @GetMapping("/{id}/activity-log")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    public List<com.example.cafemangmentsystem.tenant.entity.TenantActivityLog> getActivityLogs(@PathVariable Long id) {
        return tenantService.getTenantActivityLogs(id);
    }
}
