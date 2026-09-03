package com.example.cafemangmentsystem.tenant;

import com.example.cafemangmentsystem.billing.SubscriptionService;
import com.example.cafemangmentsystem.billing.dto.SubscriptionDto;
import com.example.cafemangmentsystem.common.tenant.TenantContext;
import com.example.cafemangmentsystem.tenant.dto.TenantResponse;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * The tenant's own view of itself. Usage, subscription detail and invoices live on
 * {@code TenantSubscriptionController}.
 */
@RestController
@RequestMapping("/api/tenant")
@RequiredArgsConstructor
public class TenantController {

    private final TenantService tenantService;
    private final SubscriptionService subscriptionService;

    @GetMapping("/me")
    public TenantResponse me() {
        return tenantService.findById(TenantContext.get());
    }

    public record UpdateLogoRequest(String logoUrl) {}

    public record SelectPlanRequest(@NotBlank String plan) {}

    @PutMapping("/logo")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    public TenantResponse updateLogo(@RequestBody UpdateLogoRequest request) {
        return tenantService.updateLogo(TenantContext.get(), request.logoUrl());
    }

    /**
     * Self-service plan selection during onboarding.
     *
     * <p>Only plans marked {@code selfSelectable} can be chosen here — in practice the free trial.
     * Picking a paid plan is a purchase, and a purchase needs either a licence key or a platform
     * admin; the endpoint says so in Arabic rather than returning an English 402 the onboarding
     * modal then rendered raw to the customer.
     */
    @PutMapping("/plan")
    @PreAuthorize("hasRole('ADMIN')")
    public SubscriptionDto selectPlan(@RequestBody SelectPlanRequest request) {
        return SubscriptionDto.from(tenantService.selectSelfServicePlan(TenantContext.get(), request.plan()));
    }
}
