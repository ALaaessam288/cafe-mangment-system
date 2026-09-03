package com.example.cafemangmentsystem.security;

import com.example.cafemangmentsystem.billing.EntitlementService;
import com.example.cafemangmentsystem.billing.dto.AccessLevel;
import com.example.cafemangmentsystem.billing.dto.Entitlements;
import com.example.cafemangmentsystem.billing.entity.SubscriptionStatus;
import com.example.cafemangmentsystem.billing.web.BillingErrorWriter;
import com.example.cafemangmentsystem.common.tenant.TenantContext;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Decides whether a request is allowed given the tenant's subscription state.
 *
 * <p>Scope is deliberately narrower than before: this filter answers only "may this tenant write
 * at all right now?". Feature entitlement moved to {@code @RequiresFeature} on the handlers, where
 * it can be seen next to the mapping it protects and applies to reads as well.
 *
 * <p>It also no longer falls through open. The old implementation ended with an unconditional
 * {@code filterChain.doFilter(...)} after its checks, so any path that reached the bottom — a
 * missing tenant row, a null context — was permitted to write.
 */
@Component
@RequiredArgsConstructor
public class SubscriptionGuardFilter extends OncePerRequestFilter {

    private final EntitlementService entitlementService;
    private final BillingErrorWriter errorWriter;

    /**
     * Paths that must stay reachable even when the subscription is dead, because they are the ways
     * out of that state: authenticating, seeing what you owe, and paying for it.
     */
    private static final List<String> EXEMPT_PATHS = List.of(
            "/api/auth/",
            "/api/platform/",
            "/api/admin/",
            "/api/plans",
            "/api/tenant/me",
            "/api/tenant/usage",
            "/api/tenant/subscription",
            "/api/tenant/logo",
            "/api/tenant/license/",
            "/api/license/",
            "/actuator/health",
            "/v3/api-docs",
            "/swagger-ui"
    );

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        String path = request.getRequestURI();
        if (!path.startsWith("/api/") || isExempt(path)) {
            chain.doFilter(request, response);
            return;
        }

        Long tenantId = TenantContext.get();
        if (tenantId == null) {
            // Unauthenticated or pre-tenant. Spring Security decides; this filter has no opinion.
            chain.doFilter(request, response);
            return;
        }

        Entitlements entitlements = entitlementService.forTenant(tenantId);

        if (entitlements.accessLevel() == AccessLevel.BLOCKED) {
            errorWriter.write(response, HttpServletResponse.SC_FORBIDDEN, "ACCOUNT_SUSPENDED",
                    "تم إيقاف هذا الحساب من قِبل إدارة المنصة. يرجى التواصل مع الدعم الفني.",
                    entitlements.planCode());
            return;
        }

        boolean readRequest = isRead(request.getMethod());
        if (readRequest || entitlements.canWrite()) {
            // Surface the countdown on every response so the client can warn before the lockout,
            // instead of discovering it when a cashier's first write of the day fails.
            annotate(response, entitlements);
            chain.doFilter(request, response);
            return;
        }

        SubscriptionStatus status = entitlements.status();
        String message = status == SubscriptionStatus.CANCELLED
                ? "تم إلغاء هذا الاشتراك. يرجى التواصل مع الدعم لإعادة التفعيل."
                : "انتهت صلاحية اشتراكك وانتهت مهلة السماح. يرجى تجديد الاشتراك أو تفعيل مفتاح ترخيص جديد للمتابعة.";
        errorWriter.write(response, HttpServletResponse.SC_FORBIDDEN, "SUBSCRIPTION_EXPIRED", message,
                entitlements.planCode());
    }

    private void annotate(HttpServletResponse response, Entitlements entitlements) {
        if (entitlements.status() == null) return;
        response.setHeader("X-Subscription-Status", entitlements.status().name());
        Long days = entitlements.daysRemaining();
        if (days != null) {
            response.setHeader("X-Subscription-Days-Remaining", days.toString());
        }
        if (entitlements.inGrace()) {
            response.setHeader("X-Subscription-Grace", "true");
        }
    }

    private boolean isRead(String method) {
        return "GET".equalsIgnoreCase(method) || "HEAD".equalsIgnoreCase(method)
                || "OPTIONS".equalsIgnoreCase(method);
    }

    private boolean isExempt(String path) {
        for (String exempt : EXEMPT_PATHS) {
            if (path.startsWith(exempt)) return true;
        }
        return false;
    }
}
