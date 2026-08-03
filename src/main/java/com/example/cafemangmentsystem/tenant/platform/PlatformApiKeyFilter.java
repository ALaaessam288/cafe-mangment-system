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
 * Gates /api/platform/** with a static, env-overridable API key instead of the normal JWT chain -
 * there's no tenant-scoped user to authenticate as when the request's whole purpose is creating
 * the first tenant. Not a substitute for real operator auth; the surface behind it is
 * intentionally tiny (see PlatformProvisioningController).
 */
@Component
public class PlatformApiKeyFilter extends OncePerRequestFilter {

    private static final String HEADER = "X-Platform-Api-Key";

    private final String expectedKey;

    public PlatformApiKeyFilter(@Value("${app.platform.provisioning-key}") String expectedKey) {
        this.expectedKey = expectedKey;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                     @NonNull HttpServletResponse response,
                                     @NonNull FilterChain filterChain) throws ServletException, IOException {
        if (request.getMethod().equalsIgnoreCase("OPTIONS") || !request.getRequestURI().startsWith("/api/platform/")) {
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

    private boolean constantTimeEquals(String a, String b) {
        return java.security.MessageDigest.isEqual(
                a.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                b.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }
}
