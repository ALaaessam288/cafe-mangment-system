package com.example.cafemangmentsystem.license;

import com.example.cafemangmentsystem.billing.dto.SubscriptionDto;
import com.example.cafemangmentsystem.common.tenant.TenantContext;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequiredArgsConstructor
public class LicenseKeyController {

    private final LicenseKeyService service;

    // ── Platform owner ──────────────────────────────────────────────────────

    @GetMapping({"/api/admin/licenses", "/api/platform/licenses"})
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public List<LicenseKey> listAll() {
        return service.listAll();
    }

    /**
     * @param durationDays      how much subscription redeeming this key grants. 0 = perpetual.
     * @param redeemableForDays how long the key may be redeemed. Null = forever. Deliberately
     *                          separate from {@code durationDays}: one date doing both jobs is what
     *                          turned a year-long key redeemed late into a six-week subscription.
     */
    public record GenerateRequest(
            @NotBlank String planCode,
            int durationDays,
            Integer redeemableForDays,
            Integer maxActivations,
            BigDecimal price,
            String notes
    ) {}

    @PostMapping({"/api/admin/licenses", "/api/platform/licenses"})
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public LicenseKey generate(@Valid @RequestBody GenerateRequest request) {
        return service.generate(request.planCode(), request.durationDays(), request.redeemableForDays(),
                request.maxActivations(), request.price(), request.notes());
    }

    public record RevokeRequest(String reason) {}

    @PostMapping({"/api/admin/licenses/{id}/revoke", "/api/platform/licenses/{id}/revoke"})
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public LicenseKey revoke(@PathVariable Long id, @RequestBody(required = false) RevokeRequest request) {
        return service.revoke(id, request != null ? request.reason() : null);
    }

    /** Redeem on a customer's behalf, e.g. over the phone. */
    public record AdminActivateRequest(@NotBlank String key, Long tenantId) {}

    @PostMapping({"/api/admin/licenses/activate", "/api/platform/licenses/activate"})
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public SubscriptionDto activateForTenant(@Valid @RequestBody AdminActivateRequest request) {
        return SubscriptionDto.from(service.redeem(request.key(), request.tenantId()));
    }

    // ── Anyone: is this key worth anything? ─────────────────────────────────

    @GetMapping("/api/license/validate")
    public LicenseKeyValidationResult validate(@RequestParam @NotBlank String key) {
        return service.validate(key);
    }

    // ── Tenant self-service ─────────────────────────────────────────────────

    public record TenantActivateRequest(@NotBlank String key) {}

    /**
     * Reachable even when the subscription has lapsed — this endpoint is exempt from the guard
     * filter, because redeeming a key is precisely how a locked-out café gets back to work.
     */
    @PostMapping("/api/tenant/license/activate")
    @PreAuthorize("hasRole('ADMIN')")
    public SubscriptionDto activateForCurrentTenant(@Valid @RequestBody TenantActivateRequest request) {
        return SubscriptionDto.from(service.redeem(request.key(), TenantContext.get()));
    }
}
