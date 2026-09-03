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
import org.springframework.web.bind.annotation.RequestParam;
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
    private final com.example.cafemangmentsystem.security.RateLimiterService rateLimiterService;
    private final com.example.cafemangmentsystem.billing.EntitlementService entitlementService;

    @GetMapping("/tenants")
    public List<PublicTenantDto> listTenants() {
        return tenantService.findAllPublic();
    }

    /**
     * Public self-service signup. Creates a tenant on the free trial and signs the owner straight in.
     *
     * <p>Throttled by client address and counting <em>successes as well as failures</em>: on an open
     * signup endpoint each success is exactly what an abuser wants, so a failure-only limiter would
     * have let one client mint tenants all day. This endpoint had no limit of any kind.
     */
    @PostMapping("/register-trial")
    @ResponseStatus(HttpStatus.CREATED)
    public com.example.cafemangmentsystem.tenant.platform.dto.ProvisionTenantResponse registerTrial(
            @Valid @RequestBody com.example.cafemangmentsystem.tenant.platform.dto.ProvisionTenantRequest request,
            jakarta.servlet.http.HttpServletRequest http) {
        rateLimiterService.checkThroughput("signup:" + clientAddress(http), 5, 3600);
        return tenantService.registerTrialTenant(request);
    }

    /**
     * Whether a workspace address is free, so the signup form can say so before submitting rather
     * than losing the customer's whole form to a 409.
     */
    @GetMapping("/slug-available")
    public java.util.Map<String, Object> slugAvailable(@RequestParam String slug,
                                                       jakarta.servlet.http.HttpServletRequest http) {
        rateLimiterService.checkThroughput("slugcheck:" + clientAddress(http), 60, 60);
        String normalised = slug == null ? "" : slug.trim().toLowerCase(java.util.Locale.ROOT);
        boolean valid = normalised.matches("^[a-z0-9]+(?:-[a-z0-9]+)*$") && normalised.length() <= 48;
        boolean reserved = java.util.Set.of("platform", "admin", "api", "www", "app", "super-admin")
                .contains(normalised);
        boolean taken = valid && !reserved && tenantRepository.existsBySlug(normalised);
        return java.util.Map.of(
                "slug", normalised,
                "valid", valid,
                "available", valid && !reserved && !taken,
                "reason", !valid ? "INVALID" : reserved ? "RESERVED" : taken ? "TAKEN" : "OK");
    }

    /**
     * Best-effort client address. Honours X-Forwarded-For because the app sits behind a proxy on
     * Railway; a spoofed header only lets an abuser share someone else's bucket, never bypass it,
     * since an unknown value simply gets its own.
     */
    private String clientAddress(jakarta.servlet.http.HttpServletRequest http) {
        String forwarded = http.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return http.getRemoteAddr();
    }

    /**
     * Tenant sign-in.
     *
     * <p>The brute-force limiter is wired here now. {@code RateLimiterService} existed in the
     * codebase and was injected into this class, but no method on it was ever called from anywhere,
     * so password guessing was unlimited. Attempts are metered per address-and-account rather than
     * per account alone, so one attacker cannot lock a real café out of its own till.
     */
    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request,
                               jakarta.servlet.http.HttpServletRequest http) {
        if (request.tenantSlug() == null || request.tenantSlug().isBlank()) {
            throw new BadCredentialsException("Tenant is required");
        }
        String attemptKey = "login:" + clientAddress(http) + ":"
                + request.tenantSlug().trim().toLowerCase() + ":"
                + (request.username() == null ? "-" : request.username().trim().toLowerCase());
        rateLimiterService.checkLockout(attemptKey);

        Tenant tenant;
        try {
            tenant = tenantService.resolveLoginableTenant(request.tenantSlug().trim().toLowerCase());
        } catch (RuntimeException unknownTenant) {
            rateLimiterService.recordFailure(attemptKey);
            throw unknownTenant;
        }

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

            rateLimiterService.reset(attemptKey);
            return LoginResponse.of(token, refreshToken, principal.getId(), principal.getUsername(),
                    principal.getFullName(), role, tenant, entitlementService.forTenant(tenant.getId()));
        } catch (RuntimeException badCredentials) {
            rateLimiterService.recordFailure(attemptKey);
            throw badCredentials;
        } finally {
            TenantContext.clear();
        }
    }

    public record SuperAdminLoginRequest(
            @NotBlank(message = "اسم مستخدم مالك المنصة مطلوب") String username,
            @NotBlank(message = "كلمة مرور مالك المنصة مطلوبة") String password
    ) {}

    @PostMapping("/super-admin/login")
    public LoginResponse superAdminLogin(@Valid @RequestBody SuperAdminLoginRequest request,
                                         jakarta.servlet.http.HttpServletRequest http) {
        String attemptKey = "superadmin:" + clientAddress(http) + ":" + request.username().trim().toLowerCase();
        rateLimiterService.checkLockout(attemptKey);
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

            rateLimiterService.reset(attemptKey);
            // The platform tenant is not a customer: it has no subscription, and hardcoding one
            // (the old response claimed ENTERPRISE with 9999 of everything) put a fictional plan in
            // the super-admin's session that no server-side check would ever have honoured.
            return LoginResponse.of(token, refreshToken, principal.getId(), principal.getUsername(),
                    principal.getFullName(), com.example.cafemangmentsystem.user.entity.Role.SUPER_ADMIN.name(),
                    platformTenant, com.example.cafemangmentsystem.billing.dto.Entitlements.platform());
        } catch (RuntimeException badCredentials) {
            rateLimiterService.recordFailure(attemptKey);
            throw badCredentials;
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

            return LoginResponse.of(token, refreshToken, principal.getId(), principal.getUsername(),
                    principal.getFullName(), role, tenant, entitlementService.forTenant(tenant.getId()));
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

        var entitlements = tenant != null
                ? entitlementService.forTenant(tenant.getId())
                : com.example.cafemangmentsystem.billing.dto.Entitlements.none(null);

        return LoginResponse.of(token, result.rawRefreshToken(), principal.getId(), principal.getUsername(),
                principal.getFullName(), role, tenant, entitlements);
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
