package com.caffio.billing.web;

import com.caffio.billing.BillingService;
import com.caffio.billing.SubscriptionService;
import com.caffio.billing.TenantUsageService;
import com.caffio.billing.dto.SubscriptionDto;
import com.caffio.billing.dto.TenantUsageDto;
import com.caffio.billing.entity.SubscriptionInvoice;
import com.caffio.common.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** What the signed-in tenant can see about its own subscription. Never blocked by the guard. */
@RestController
@RequestMapping("/api/tenant")
@RequiredArgsConstructor
public class TenantSubscriptionController {

    private final SubscriptionService subscriptionService;
    private final TenantUsageService usageService;
    private final BillingService billingService;

    @GetMapping("/subscription")
    public SubscriptionDto subscription() {
        return SubscriptionDto.from(subscriptionService.requireCurrent(TenantContext.get()));
    }

    @GetMapping("/subscription/history")
    @PreAuthorize("hasRole('ADMIN')")
    public List<SubscriptionDto> history() {
        return subscriptionService.historyFor(TenantContext.get()).stream().map(SubscriptionDto::from).toList();
    }

    @GetMapping("/usage")
    public TenantUsageDto usage() {
        return usageService.forTenant(TenantContext.get());
    }

    @GetMapping("/invoices")
    @PreAuthorize("hasRole('ADMIN')")
    public List<SubscriptionInvoice> invoices() {
        return billingService.invoicesFor(TenantContext.get());
    }
}
