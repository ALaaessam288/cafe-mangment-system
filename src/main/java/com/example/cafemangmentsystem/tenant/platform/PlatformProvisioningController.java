package com.example.cafemangmentsystem.tenant.platform;

import com.example.cafemangmentsystem.tenant.TenantService;
import com.example.cafemangmentsystem.tenant.platform.dto.ProvisionTenantRequest;
import com.example.cafemangmentsystem.tenant.platform.dto.ProvisionTenantResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Ops-only tenant bootstrap, gated by {@link PlatformApiKeyFilter} rather than the normal JWT
 * chain. Not a public signup flow - just the one call needed to create a tenant + its first
 * ADMIN user so the tenant can then log in normally via /api/auth/login.
 */
@RestController
@RequestMapping("/api/platform/tenants")
@RequiredArgsConstructor
public class PlatformProvisioningController {

    private final TenantService tenantService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProvisionTenantResponse provision(@Valid @RequestBody ProvisionTenantRequest request) {
        return tenantService.provisionWithSetup(request);
    }
}
