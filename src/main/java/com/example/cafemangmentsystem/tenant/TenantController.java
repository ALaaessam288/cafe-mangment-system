package com.example.cafemangmentsystem.tenant;

import com.example.cafemangmentsystem.billing.SubscriptionService;
import com.example.cafemangmentsystem.billing.dto.SubscriptionDto;
import com.example.cafemangmentsystem.common.tenant.TenantContext;
import com.example.cafemangmentsystem.common.whatsapp.WhatsAppService;
import com.example.cafemangmentsystem.tenant.dto.TenantResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
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
    private final WhatsAppService whatsAppService;

    @GetMapping("/me")
    public TenantResponse me() {
        return tenantService.findById(TenantContext.get());
    }

    public record UpdateLogoRequest(String logoUrl) {}

    public record SelectPlanRequest(@NotBlank String plan) {}

    /**
     * Same shape the platform admin's settings endpoint validates, so a number the owner types is
     * held to the rule a provisioned number already was.
     */
    public record UpdateWhatsAppRequest(
            @Size(max = 24)
            @Pattern(regexp = "^$|^(?=(?:[^0-9]*[0-9]){10,15}[^0-9]*$)[+0-9 ()-]{10,24}$",
                     message = "رقم الواتساب غير صحيح")
            String ownerWhatsapp,
            Boolean whatsappAlertsEnabled
    ) {}

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

    /**
     * The café's own WhatsApp alert settings.
     *
     * <p>{@code ownerWhatsapp} and {@code whatsappAlertsEnabled} could previously only be set by the
     * platform owner — at provisioning, or through the admin console. The café's settings screen
     * showed a WhatsApp card that called nothing and reported success anyway, so every tenant sat on
     * the {@code whatsappAlertsEnabled = false} default believing they had switched alerts on, and
     * {@code SubscriptionExpiryJob} correctly declined to message any of them. The owner needs to own
     * this setting; it is their phone number.
     */
    @PutMapping("/whatsapp")
    @PreAuthorize("hasRole('ADMIN')")
    public TenantResponse updateWhatsApp(@Valid @RequestBody UpdateWhatsAppRequest request) {
        return tenantService.updateWhatsAppSettings(
                TenantContext.get(),
                request.ownerWhatsapp(),
                request.whatsappAlertsEnabled());
    }

    /**
     * Sends a test message to the café's own stored WhatsApp number.
     *
     * <p>Deliberately takes no recipient. The number is read from the tenant, never from the
     * request: an endpoint a café admin can point at an arbitrary number is an outbound message
     * relay wearing a test button, and the linked WhatsApp account is one abuse report away from
     * being restricted. Testing "will my alerts arrive" only ever means "at the number I saved".
     *
     * <p>Synchronous, because an async answer would say "queued" and leave the owner exactly as
     * uncertain as the fake success toast this whole card used to show.
     */
    @PostMapping("/whatsapp/test")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<WhatsAppService.DispatchResult> sendWhatsAppTest() {
        TenantResponse tenant = tenantService.findById(TenantContext.get());

        if (tenant.ownerWhatsapp() == null || tenant.ownerWhatsapp().isBlank()) {
            return ResponseEntity.badRequest().body(
                    new WhatsAppService.DispatchResult(false, "احفظ رقم الواتساب الأول."));
        }

        WhatsAppService.DispatchResult result = whatsAppService.sendNow(
                tenant.ownerWhatsapp(),
                "رسالة تجربة من Caffio ☕\n\nلو وصلتك دي، يبقى تنبيهات الواتساب هتوصلك على الرقم ده.");

        // 502, not 500: the fault is the gateway upstream, and the café owner deserves the reason
        // rather than a generic failure.
        return result.dispatched() ? ResponseEntity.ok(result) : ResponseEntity.status(502).body(result);
    }
}
