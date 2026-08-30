package com.example.cafemangmentsystem.auth;

import com.example.cafemangmentsystem.auth.dto.LoginRequest;
import com.example.cafemangmentsystem.auth.dto.LoginResponse;
import com.example.cafemangmentsystem.auth.dto.RefreshRequest;
import com.example.cafemangmentsystem.common.tenant.TenantContext;
import com.example.cafemangmentsystem.security.UserPrincipal;
import com.example.cafemangmentsystem.security.jwt.JwtService;
import com.example.cafemangmentsystem.security.refresh.RefreshTokenService;
import com.example.cafemangmentsystem.security.refresh.RotationResult;
import com.example.cafemangmentsystem.tenant.TenantService;
import com.example.cafemangmentsystem.tenant.repository.TenantRepository;
import com.example.cafemangmentsystem.tenant.entity.Tenant;
import com.example.cafemangmentsystem.tenant.dto.PublicTenantDto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final TenantAwareAuthenticator tenantAwareAuthenticator;
    private final JwtService jwtService;
    private final RefreshTokenService refreshTokenService;
    private final TenantService tenantService;
    private final TenantRepository tenantRepository;

    @GetMapping("/tenants")
    public List<PublicTenantDto> listTenants() {
        return tenantService.findAllPublic();
    }

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        if (request.tenantSlug() == null || request.tenantSlug().isBlank()) {
            throw new BadCredentialsException("Tenant is required");
        }
        Tenant tenant = tenantService.resolveLoginableTenant(request.tenantSlug().trim().toLowerCase());

        if (tenant == null) {
            throw new BadCredentialsException("Unknown tenant");
        }

        if (tenant.getStatus() == com.example.cafemangmentsystem.tenant.entity.TenantStatus.SUSPENDED) {
            throw new DisabledException("تم إيقاف هذا الحساب من قِبل إدارة المنصة. يرجى التواصل مع الدعم الفني للتفعيل.");
        }

        TenantContext.set(tenant.getId());
        try {
            UserPrincipal principal;
            if (request.username() != null && !request.username().trim().isEmpty()) {
                var authentication = tenantAwareAuthenticator.authenticate(request.username().trim(), request.password());
                principal = (UserPrincipal) authentication.getPrincipal();
            } else {
                com.example.cafemangmentsystem.user.entity.User user = tenantAwareAuthenticator.authenticateByPassword(request.password());
                principal = new UserPrincipal(user);
            }

            String token = jwtService.generateToken(principal);
            String refreshToken = refreshTokenService.issue(principal.getId());
            String role = principal.getAuthorities().iterator().next().getAuthority().replace("ROLE_", "");

            var plan = tenant.getSubscriptionPlan() != null ? tenant.getSubscriptionPlan() : com.example.cafemangmentsystem.tenant.entity.SubscriptionPlan.TRIAL;
            int maxTables = tenant.getMaxTables() != null ? tenant.getMaxTables() : plan.getMaxTables();
            int maxUsers = tenant.getMaxUsers() != null ? tenant.getMaxUsers() : plan.getMaxUsers();
            int maxProducts = tenant.getMaxProducts() != null ? tenant.getMaxProducts() : plan.getMaxProducts();

            return new LoginResponse(token, "Bearer", refreshToken, principal.getId(), principal.getUsername(),
                    principal.getFullName(), role, tenant.getName(), tenant.getSlug(),
                    plan.name(), plan.getDisplayName(), tenant.getTrialEndsAt(), tenant.getSubscriptionEndsAt(),
                    maxTables, maxUsers, maxProducts, plan.isIncludesKds(), plan.isIncludesExpenses(), tenant.getLogoUrl(),
                    Boolean.TRUE.equals(tenant.getPlanSelected()));
        } finally {
            TenantContext.clear();
        }
    }

    public record SuperAdminLoginRequest(
            @NotBlank(message = "اسم مستخدم مالك المنصة مطلوب") String username,
            @NotBlank(message = "كلمة مرور مالك المنصة مطلوبة") String password
    ) {}

    @PostMapping("/super-admin/login")
    public LoginResponse superAdminLogin(@Valid @RequestBody SuperAdminLoginRequest request) {
        // Platform access must never fall back to a customer tenant. A fallback allowed a
        // customer administrator to authenticate through this endpoint when the platform tenant
        // was missing or misconfigured.
        Tenant platformTenant = tenantRepository.findBySlug("platform")
                .orElseThrow(() -> new BadCredentialsException("Platform tenant is not configured"));

        TenantContext.set(platformTenant.getId());
        try {
            var authentication = tenantAwareAuthenticator.authenticate(request.username().trim(), request.password());
            UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();

            boolean isSuperAdmin = principal.getAuthorities().stream()
                    .anyMatch(authority -> "ROLE_SUPER_ADMIN".equals(authority.getAuthority()));
            if (!isSuperAdmin) {
                throw new BadCredentialsException("Platform owner role is required");
            }

            String token = jwtService.generateToken(principal);
            String refreshToken = refreshTokenService.issue(principal.getId());

            return new LoginResponse(token, "Bearer", refreshToken, principal.getId(), principal.getUsername(),
                    principal.getFullName(), com.example.cafemangmentsystem.user.entity.Role.SUPER_ADMIN.name(), "Caffio Platform Master", "platform",
                    "ENTERPRISE", "Platform Master", null, null,
                    9999, 9999, 9999, true, true, null, true);
        } finally {
            TenantContext.clear();
        }
    }

    @PostMapping("/login-pin")
    public LoginResponse loginPin(@Valid @RequestBody com.example.cafemangmentsystem.auth.dto.LoginPinRequest request) {
        Tenant tenant = tenantService.resolveLoginableTenant(request.getTenantSlug());
        if (tenant.getStatus() == com.example.cafemangmentsystem.tenant.entity.TenantStatus.SUSPENDED) {
            throw new DisabledException("تم إيقاف هذا الحساب من قِبل إدارة المنصة. يرجى التواصل مع الدعم الفني للتفعيل.");
        }

        TenantContext.set(tenant.getId());
        try {
            com.example.cafemangmentsystem.user.entity.User user = tenantAwareAuthenticator.authenticateByPin(request.getPin());
            UserPrincipal principal = new UserPrincipal(user);
            String token = jwtService.generateToken(principal);
            String refreshToken = refreshTokenService.issue(principal.getId());
            String role = principal.getAuthorities().iterator().next().getAuthority().replace("ROLE_", "");

            var plan = tenant.getSubscriptionPlan() != null ? tenant.getSubscriptionPlan() : com.example.cafemangmentsystem.tenant.entity.SubscriptionPlan.TRIAL;
            int maxTables = tenant.getMaxTables() != null ? tenant.getMaxTables() : plan.getMaxTables();
            int maxUsers = tenant.getMaxUsers() != null ? tenant.getMaxUsers() : plan.getMaxUsers();
            int maxProducts = tenant.getMaxProducts() != null ? tenant.getMaxProducts() : plan.getMaxProducts();

            return new LoginResponse(token, "Bearer", refreshToken, principal.getId(), principal.getUsername(),
                    principal.getFullName(), role, tenant.getName(), tenant.getSlug(),
                    plan.name(), plan.getDisplayName(), tenant.getTrialEndsAt(), tenant.getSubscriptionEndsAt(),
                    maxTables, maxUsers, maxProducts, plan.isIncludesKds(), plan.isIncludesExpenses(), tenant.getLogoUrl(),
                    Boolean.TRUE.equals(tenant.getPlanSelected()));
        } finally {
            TenantContext.clear();
        }
    }

    @PostMapping("/refresh")
    public LoginResponse refresh(@Valid @RequestBody RefreshRequest request) {
        RotationResult result = refreshTokenService.rotate(request.refreshToken());
        UserPrincipal principal = new UserPrincipal(result.user());
        String token = jwtService.generateToken(principal);
        String role = principal.getAuthorities().iterator().next().getAuthority().replace("ROLE_", "");
        Tenant tenant = tenantRepository.findById(result.user().getTenantId()).orElse(null);

        if (tenant != null && tenant.getStatus() == com.example.cafemangmentsystem.tenant.entity.TenantStatus.SUSPENDED) {
            throw new DisabledException("تم إيقاف هذا الحساب من قِبل إدارة المنصة. يرجى التواصل مع الدعم الفني للتفعيل.");
        }

        String tenantName = tenant != null ? tenant.getName() : null;
        String tenantSlug = tenant != null ? tenant.getSlug() : null;

        var plan = (tenant != null && tenant.getSubscriptionPlan() != null) ? tenant.getSubscriptionPlan() : com.example.cafemangmentsystem.tenant.entity.SubscriptionPlan.TRIAL;
        int maxTables = (tenant != null && tenant.getMaxTables() != null) ? tenant.getMaxTables() : plan.getMaxTables();
        int maxUsers = (tenant != null && tenant.getMaxUsers() != null) ? tenant.getMaxUsers() : plan.getMaxUsers();
        int maxProducts = (tenant != null && tenant.getMaxProducts() != null) ? tenant.getMaxProducts() : plan.getMaxProducts();

        return new LoginResponse(token, "Bearer", result.rawRefreshToken(), principal.getId(), principal.getUsername(),
                principal.getFullName(), role, tenantName, tenantSlug,
                plan.name(), plan.getDisplayName(), tenant != null ? tenant.getTrialEndsAt() : null, tenant != null ? tenant.getSubscriptionEndsAt() : null,
                maxTables, maxUsers, maxProducts, plan.isIncludesKds(), plan.isIncludesExpenses(), tenant != null ? tenant.getLogoUrl() : null,
                tenant != null && Boolean.TRUE.equals(tenant.getPlanSelected()));
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@Valid @RequestBody RefreshRequest request) {
        refreshTokenService.revoke(request.refreshToken());
    }

    @ExceptionHandler(DisabledException.class)
    public ResponseEntity<Map<String, Object>> handleDisabled(DisabledException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("status", 403, "error", "ACCOUNT_DISABLED", "message", ex.getMessage() != null ? ex.getMessage() : "تم إيقاف هذا الحساب من قِبل إدارة المنصة"));
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<Map<String, Object>> handleAuthFailure(BadCredentialsException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("status", 401, "error", "Unauthorized", "message", "اسم المستخدم أو كلمة المرور غير صحيحة"));
    }
}
