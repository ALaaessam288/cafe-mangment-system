package com.example.cafemangmentsystem.license;

import com.example.cafemangmentsystem.tenant.entity.SubscriptionPlan;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class LicenseKeyController {

    private final LicenseKeyService service;

    // ── Super-admin endpoints (JWT auth with SUPER_ADMIN role) ───────────────

    @GetMapping({"/api/admin/licenses", "/api/platform/licenses"})
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    public List<LicenseKey> listAll() {
        return service.listAll();
    }

    public record GenerateRequest(
            @NotBlank String plan,
            int validDays,   // 0 = never expires
            String notes
    ) {}

    @PostMapping({"/api/admin/licenses", "/api/platform/licenses"})
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public LicenseKey generate(@RequestBody GenerateRequest req) {
        return service.generate(SubscriptionPlan.valueOf(req.plan()), req.validDays(), req.notes());
    }

    @DeleteMapping({"/api/admin/licenses/{id}/revoke", "/api/platform/licenses/{id}/revoke"})
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    public LicenseKey revoke(@PathVariable Long id) {
        return service.revoke(id);
    }

    // ── Public endpoint (called by Electron app to validate a key) ────────────

    @GetMapping("/api/license/validate")
    public LicenseKeyValidationResult validate(@RequestParam @NotBlank String key) {
        return service.validate(key);
    }

    // ── Called during tenant provisioning or by Super Admin ──────────────────

    @PostMapping({"/api/admin/licenses/activate", "/api/platform/licenses/activate"})
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    public LicenseKey activate(@RequestBody Map<String, Object> body) {
        String key = (String) body.get("key");
        Long tenantId = Long.valueOf(body.get("tenantId").toString());
        return service.activate(key, tenantId);
    }

    // ── Tenant Self-Service Activation (Tenant Admin / Owner) ─────────────────

    public record TenantActivateRequest(@NotBlank String key) {}

    @PostMapping("/api/tenant/license/activate")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    public com.example.cafemangmentsystem.tenant.dto.TenantResponse activateForCurrentTenant(
            @RequestBody TenantActivateRequest req) {
        Long tenantId = com.example.cafemangmentsystem.common.tenant.TenantContext.get();
        return service.activateTenantLicense(tenantId, req.key());
    }
}
