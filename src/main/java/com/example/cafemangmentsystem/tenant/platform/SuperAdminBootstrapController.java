package com.example.cafemangmentsystem.tenant.platform;

import com.example.cafemangmentsystem.common.tenant.TenantContext;
import com.example.cafemangmentsystem.tenant.TenantService;
import com.example.cafemangmentsystem.tenant.entity.BusinessType;
import com.example.cafemangmentsystem.tenant.platform.dto.ProvisionTenantRequest;
import com.example.cafemangmentsystem.tenant.platform.dto.ProvisionTenantResponse;
import com.example.cafemangmentsystem.user.entity.Role;
import com.example.cafemangmentsystem.user.entity.User;
import com.example.cafemangmentsystem.user.repository.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

/**
 * One-time bootstrap: creates the platform tenant + a SUPER_ADMIN user.
 * Protected by the same X-Platform-Api-Key header as the provisioning controller.
 *
 * Call once after first deployment:
 *   POST /api/platform/super-admin
 *   X-Platform-Api-Key: <APP_PLATFORM_PROVISIONING_KEY>
 *   { "username": "superadmin", "password": "...", "fullName": "Platform Owner" }
 */
@RestController
@RequestMapping("/api/platform/super-admin")
@RequiredArgsConstructor
public class SuperAdminBootstrapController {

    private final TenantService tenantService;
    private final UserRepository userRepository;

    public record CreateSuperAdminRequest(
            @NotBlank String username,
            @NotBlank @Size(min = 8) String password,
            @NotBlank String fullName
    ) {}

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProvisionTenantResponse createSuperAdmin(@Valid @RequestBody CreateSuperAdminRequest req) {
        // Provision the "platform" tenant (or reuse if slug already exists)
        ProvisionTenantRequest provisionReq = new ProvisionTenantRequest(
                "Caffio Platform",
                "platform",
                BusinessType.CAFE,
                req.username(),
                req.password(),
                req.fullName(),
                "UTC", "EGP", null, 0
        );

        ProvisionTenantResponse response;
        try {
            response = tenantService.provisionWithSetup(provisionReq);
        } catch (org.springframework.web.server.ResponseStatusException ex) {
            if (ex.getStatusCode().value() == 409) {
                // Slug already exists — still promote the user
                com.example.cafemangmentsystem.tenant.entity.Tenant platform =
                        tenantService.resolveLoginableTenant("platform");
                TenantContext.set(platform.getId());
                try {
                    userRepository.findByTenantIdAndUsername(platform.getId(), req.username()).ifPresent(u -> {
                        u.setRole(Role.SUPER_ADMIN);
                        userRepository.save(u);
                    });
                } finally {
                    TenantContext.clear();
                }
                return new ProvisionTenantResponse(platform.getId(), "platform", req.username(), null);
            }
            throw ex;
        }

        // Promote the newly created ADMIN user to SUPER_ADMIN
        com.example.cafemangmentsystem.tenant.entity.Tenant platform =
                tenantService.resolveLoginableTenant("platform");
        TenantContext.set(platform.getId());
        try {
            userRepository.findByTenantIdAndUsername(platform.getId(), req.username()).ifPresent(u -> {
                u.setRole(Role.SUPER_ADMIN);
                userRepository.save(u);
            });
        } finally {
            TenantContext.clear();
        }

        return response;
    }
}
