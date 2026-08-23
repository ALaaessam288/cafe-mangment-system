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
    @PreAuthorize("hasRole('ADMIN')")
    public List<TenantResponse> listAllTenants() {
        return tenantService.findAllTenants();
    }

    public record UpdateSubscriptionRequest(
            SubscriptionPlan plan,
            TenantStatus status,
            Integer extendDays
    ) {}

    @PostMapping("/provision")
    @PreAuthorize("hasRole('ADMIN')")
    public com.example.cafemangmentsystem.tenant.platform.dto.ProvisionTenantResponse provisionTenant(@RequestBody com.example.cafemangmentsystem.tenant.platform.dto.ProvisionTenantRequest request) {
        return tenantService.provisionWithSetup(request);
    }

    @PutMapping("/{id}/subscription")
    @PreAuthorize("hasRole('ADMIN')")
    public TenantResponse updateSubscription(@PathVariable Long id, @RequestBody UpdateSubscriptionRequest request) {
        return tenantService.updateTenantSubscription(id, request.plan(), request.status(), request.extendDays());
    }

    @GetMapping("/stats")
    @PreAuthorize("hasRole('ADMIN')")
    public java.util.Map<String, Object> getPlatformStats() {
        return tenantService.getPlatformStats();
    }

    @GetMapping("/{id}/usage")
    @PreAuthorize("hasRole('ADMIN')")
    public java.util.Map<String, Object> getTenantUsage(@PathVariable Long id) {
        return tenantService.getTenantUsage(id);
    }
    
    public record UpdateQuotasRequest(
            Integer maxTables,
            Integer maxUsers,
            Integer maxProducts
    ) {}

    @PutMapping("/{id}/quotas")
    @PreAuthorize("hasRole('ADMIN')")
    public TenantResponse updateQuotas(@PathVariable Long id, @RequestBody UpdateQuotasRequest request) {
        return tenantService.updateQuotas(id, request.maxTables(), request.maxUsers(), request.maxProducts());
    }

    @GetMapping("/{id}/activity")
    @PreAuthorize("hasRole('ADMIN')")
    public List<com.example.cafemangmentsystem.tenant.entity.TenantActivityLog> getActivityLogs(@PathVariable Long id) {
        return tenantService.getTenantActivityLogs(id);
    }
}
