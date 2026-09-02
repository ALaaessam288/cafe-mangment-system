package com.example.cafemangmentsystem.security;

import com.example.cafemangmentsystem.common.tenant.TenantContext;
import com.example.cafemangmentsystem.tenant.entity.SubscriptionPlan;
import com.example.cafemangmentsystem.tenant.entity.Tenant;
import com.example.cafemangmentsystem.tenant.entity.TenantStatus;
import com.example.cafemangmentsystem.tenant.repository.TenantRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.List;

@Component
@RequiredArgsConstructor
public class SubscriptionGuardFilter extends OncePerRequestFilter {

    private final TenantRepository tenantRepository;
    
    private static final List<String> EXEMPT_PATHS = List.of(
            "/api/auth/",
            "/api/platform/",
            "/api/admin/",
            "/api/tenant/license/",
            "/api/tenant/me",
            "/api/tenant/usage",
            "/api/tenant/logo",
            "/api/license/",
            "/v3/api-docs",
            "/swagger-ui"
    );

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {
        String path = request.getRequestURI();
        
        // NEVER filter static assets or non-API routes
        if (!path.startsWith("/api/")) {
            filterChain.doFilter(request, response);
            return;
        }
        
        for (String exempt : EXEMPT_PATHS) {
            if (path.startsWith(exempt)) {
                filterChain.doFilter(request, response);
                return;
            }
        }

        Long tenantId = TenantContext.get();
        if (tenantId != null) {
            Tenant tenant = tenantRepository.findById(tenantId).orElse(null);
            if (tenant != null) {
                // If suspended by Super Admin, block ALL requests (including GET)
                if (tenant.getStatus() == TenantStatus.SUSPENDED) {
                    sendForbiddenResponse(response, "ACCOUNT_SUSPENDED", "تم إيقاف هذا الحساب من قِبل إدارة المنصة. يرجى التواصل مع الدعم الفني.");
                    return;
                }

                // Allow GET requests in read-only mode for expired trials/subscriptions
                if ("GET".equalsIgnoreCase(request.getMethod())) {
                    filterChain.doFilter(request, response);
                    return;
                }

                Instant now = Instant.now();
                if (tenant.getStatus() == TenantStatus.TRIAL && tenant.getTrialEndsAt() != null && now.isAfter(tenant.getTrialEndsAt())) {
                    sendForbiddenResponse(response, "SUBSCRIPTION_EXPIRED", "انتهت الفترة التجريبية (14 يوم). يرجى ترقية الباقة أو إدخال مفتاح الترخيص لمتابعة العمل.");
                    return;
                }

                if (tenant.getStatus() == TenantStatus.ACTIVE && tenant.getSubscriptionEndsAt() != null && now.isAfter(tenant.getSubscriptionEndsAt())) {
                    sendForbiddenResponse(response, "SUBSCRIPTION_EXPIRED", "انتهت صلاحية اشتراكك. يرجى تجديد الاشتراك أو تفعيل مفتاح ترخيص جديد.");
                    return;
                }

                // Feature entitlement checks for non-GET requests when on paid plans
                SubscriptionPlan plan = tenant.getSubscriptionPlan() != null ? tenant.getSubscriptionPlan() : SubscriptionPlan.TRIAL;
                if (tenant.getStatus() != TenantStatus.TRIAL) {
                    if (path.startsWith("/api/expenses") && !plan.isIncludesExpenses()) {
                        sendForbiddenResponse(response, "FEATURE_NOT_INCLUDED", "ميزة إدارة المصروفات غير مشمولة في باقتك الحالية. يرجى ترقية الباقة.");
                        return;
                    }
                    if (path.startsWith("/api/stations") && !plan.isIncludesKds()) {
                        sendForbiddenResponse(response, "FEATURE_NOT_INCLUDED", "ميزة شاشات التحضير (KDS) غير مشمولة في باقتك الحالية. يرجى ترقية الباقة.");
                        return;
                    }
                }
            }
        }

        // Allow GET requests if no tenant or tenant not expired
        if ("GET".equalsIgnoreCase(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        filterChain.doFilter(request, response);
    }

    private void sendForbiddenResponse(HttpServletResponse response, String errorCode, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"error\":\"" + errorCode + "\",\"status\":403,\"message\":\"" + message + "\"}");
    }
}
