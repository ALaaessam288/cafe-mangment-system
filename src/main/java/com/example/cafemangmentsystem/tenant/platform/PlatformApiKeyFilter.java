package com.example.cafemangmentsystem.tenant.platform;

import com.example.cafemangmentsystem.tenant.repository.TenantRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.lang.NonNull;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Gates /api/platform/** endpoints.
 * Requires one of:
 * 1. Valid X-Platform-Api-Key header
 * 2. Authenticated user with ROLE_SUPER_ADMIN
 * 3. Initial one-time bootstrap on POST /api/platform/super-admin when no platform tenant exists yet.
 */
@Component
public class PlatformApiKeyFilter extends OncePerRequestFilter {

    private static final String HEADER = "X-Platform-Api-Key";

    private final String expectedKey;
    private final TenantRepository tenantRepository;

    public PlatformApiKeyFilter(@Value("${app.platform.provisioning-key:}") String expectedKey,
                                TenantRepository tenantRepository) {
        this.expectedKey = com.example.cafemangmentsystem.security.SecretMaterial
                .resolveOrGenerate(expectedKey, "platform.key", 32);
        this.tenantRepository = tenantRepository;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                     @NonNull HttpServletResponse response,
                                     @NonNull FilterChain filterChain) throws ServletException, IOException {
        String uri = request.getRequestURI();
        if (request.getMethod().equalsIgnoreCase("OPTIONS") || !uri.startsWith("/api/platform/")) {
            filterChain.doFilter(request, response);
            return;
        }

        // Check 1: Valid Platform API Key
        String provided = request.getHeader(HEADER);
        if (provided != null && constantTimeEquals(provided, expectedKey)) {
            filterChain.doFilter(request, response);
            return;
        }

        // Check 2: Authenticated SUPER_ADMIN
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() &&
                auth.getAuthorities().stream().anyMatch(a -> "ROLE_SUPER_ADMIN".equals(a.getAuthority()))) {
            filterChain.doFilter(request, response);
            return;
        }

        // Check 3: One-time initial bootstrap when NO platform tenant exists at all
        if (request.getMethod().equalsIgnoreCase("POST") && uri.equals("/api/platform/super-admin")) {
            boolean platformExists = tenantRepository.findBySlug("platform").isPresent();
            if (!platformExists) {
                filterChain.doFilter(request, response);
                return;
            }
        }

        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"status\":401,\"error\":\"Unauthorized\",\"message\":\"Requires valid " + HEADER + " or SUPER_ADMIN authentication\"}");
    }

    private boolean constantTimeEquals(String a, String b) {
        return java.security.MessageDigest.isEqual(
                a.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                b.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }
}
