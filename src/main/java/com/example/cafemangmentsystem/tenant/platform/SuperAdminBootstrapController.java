package com.example.cafemangmentsystem.tenant.platform;

import com.example.cafemangmentsystem.common.tenant.TenantContext;
import com.example.cafemangmentsystem.tenant.entity.BusinessType;
import com.example.cafemangmentsystem.tenant.entity.Tenant;
import com.example.cafemangmentsystem.tenant.entity.TenantStatus;
import com.example.cafemangmentsystem.tenant.repository.TenantRepository;
import com.example.cafemangmentsystem.tenant.platform.dto.ProvisionTenantResponse;
import com.example.cafemangmentsystem.user.entity.User;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

/**
 * Creates the initial platform owner or recovers its credentials.
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

    private final TenantRepository tenantRepository;
    private final PlatformAdminSaver adminSaver;

    public record CreateSuperAdminRequest(
            @NotBlank String username,
            @NotBlank
            @Size(min = 12, message = "كلمة مرور مالك المنصة يجب ألا تقل عن 12 حرفاً")
            @Pattern(
                    regexp = "^(?=.*\\p{L})(?=.*\\d).+$",
                    message = "كلمة مرور مالك المنصة يجب أن تحتوي على حرف ورقم على الأقل")
            String password,
            @NotBlank String fullName
    ) {}

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProvisionTenantResponse createSuperAdmin(@Valid @RequestBody CreateSuperAdminRequest req) {
        Tenant platform = tenantRepository.findBySlug("platform").orElseGet(this::createPlatformTenant);

        TenantContext.set(platform.getId());
        try {
            User admin = adminSaver.upsertSuperAdmin(
                    platform.getId(),
                    req.username().trim(),
                    req.fullName().trim(),
                    req.password());
            return new ProvisionTenantResponse(platform.getId(), platform.getSlug(), admin.getUsername(), null);
        } finally {
            TenantContext.clear();
        }
    }

    private Tenant createPlatformTenant() {
        Tenant platform = new Tenant();
        platform.setName("Caffio Platform");
        platform.setSlug("platform");
        platform.setBusinessType(BusinessType.CAFE_AND_RESTAURANT);
        platform.setStatus(TenantStatus.ACTIVE);
        platform.setTimezone("Africa/Cairo");
        platform.setCurrency("EGP");
        platform.setPlanSelected(true);
        return tenantRepository.save(platform);
    }
}
