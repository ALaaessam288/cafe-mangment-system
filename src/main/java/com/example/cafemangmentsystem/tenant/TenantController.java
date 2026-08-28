package com.example.cafemangmentsystem.tenant;

import com.example.cafemangmentsystem.common.tenant.TenantContext;
import com.example.cafemangmentsystem.tenant.dto.TenantResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/tenant")
@RequiredArgsConstructor
public class TenantController {

    private final TenantService tenantService;

    @GetMapping("/me")
    public TenantResponse me() {
        return tenantService.findById(TenantContext.get());
    }

    @GetMapping("/usage")
    public Map<String, Object> usage() {
        return tenantService.getTenantUsageDetails(TenantContext.get());
    }

    public record UpdateLogoRequest(String logoUrl) {}

    public record SelectPlanRequest(
            com.example.cafemangmentsystem.tenant.entity.SubscriptionPlan plan
    ) {}

    @PutMapping("/logo")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    public TenantResponse updateLogo(@RequestBody UpdateLogoRequest request) {
        return tenantService.updateLogo(TenantContext.get(), request.logoUrl());
    }

    @PutMapping("/plan")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    public TenantResponse selectPlan(@RequestBody SelectPlanRequest request) {
        return tenantService.selectTenantPlan(TenantContext.get(), request.plan());
    }
}
