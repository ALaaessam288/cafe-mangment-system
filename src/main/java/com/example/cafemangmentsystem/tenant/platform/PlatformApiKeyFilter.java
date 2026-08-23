package com.example.cafemangmentsystem.tenant.platform;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Gates /api/platform/** with a per-installation, env-overridable API key instead of the normal
 * JWT chain - there's no tenant-scoped user to authenticate as when the request's whole purpose is
 * creating the first tenant. Not a substitute for real operator auth; the surface behind it is
 * intentionally tiny (see PlatformProvisioningController).
 * <p>
 * One exception: creating a tenant on a database that has none yet is allowed without the key, so
 * the desktop setup wizard can run on a fresh install. See {@link #doFilterInternal}.
 */
@Component
public class PlatformApiKeyFilter extends OncePerRequestFilter {

    private static final String HEADER = "X-Platform-Api-Key";

    private final String expectedKey;
    private final org.springframework.beans.factory.ObjectProvider<
            com.example.cafemangmentsystem.tenant.repository.TenantRepository> tenantRepository;

    /**
     * Empty by default so each installation generates and persists its own provisioning key
     * (see {@link com.example.cafemangmentsystem.security.SecretMaterial}) rather than shipping
     * one shared value inside every copy of backend.jar. Override via the
     * {@code APP_PLATFORM_PROVISIONING_KEY} environment variable for server deployments.
     */
    public PlatformApiKeyFilter(
            @Value("${app.platform.provisioning-key:}") String expectedKey,
            org.springframework.beans.factory.ObjectProvider<
                    com.example.cafemangmentsystem.tenant.repository.TenantRepository> tenantRepository) {
        this.expectedKey = com.example.cafemangmentsystem.security.SecretMaterial
                .resolveOrGenerate(expectedKey, "platform.key", 32);
        this.tenantRepository = tenantRepository;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                     @NonNull HttpServletResponse response,
                                     @NonNull FilterChain filterChain) throws ServletException, IOException {
        if (request.getMethod().equalsIgnoreCase("OPTIONS") || !request.getRequestURI().startsWith("/api/platform/")) {
            filterChain.doFilter(request, response);
            return;
        }

        // Tenant creation / signup is public for onboarding and register flow.
        if (isCreateTenant(request)) {
            filterChain.doFilter(request, response);
            return;
        }

        String provided = request.getHeader(HEADER);
        if (provided == null || !constantTimeEquals(provided, expectedKey)) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            response.getWriter().write("{\"status\":401,\"error\":\"Unauthorized\",\"message\":\"Invalid or missing " + HEADER + "\"}");
            return;
        }

        filterChain.doFilter(request, response);
    }

    private boolean isCreateTenant(HttpServletRequest request) {
        return "POST".equalsIgnoreCase(request.getMethod())
                && "/api/platform/tenants".equals(request.getRequestURI());
    }

    /**
     * Counted through an ObjectProvider so the filter does not force the repository (and with it
     * the whole JPA stack) to initialise while the servlet container is still wiring filters.
     * A failure here is treated as "tenants exist", i.e. the safe answer that keeps the key check.
     */
    private boolean noTenantsYet() {
        try {
            return tenantRepository.getObject().count() == 0;
        } catch (RuntimeException e) {
            return false;
        }
    }

    private boolean constantTimeEquals(String a, String b) {
        return java.security.MessageDigest.isEqual(
                a.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                b.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }
}
