package com.example.cafemangmentsystem.billing.web;

import com.example.cafemangmentsystem.billing.EntitlementService;
import com.example.cafemangmentsystem.billing.RequiresFeature;
import com.example.cafemangmentsystem.billing.dto.Entitlements;
import com.example.cafemangmentsystem.billing.entity.Feature;
import com.example.cafemangmentsystem.common.tenant.TenantContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Enforces {@link RequiresFeature} at the handler level, where the mapping and the requirement sit
 * side by side and cannot drift apart.
 *
 * <p>Implemented as an interceptor rather than an AOP aspect deliberately: it needs the resolved
 * handler method, it runs after security has populated the tenant context, and it adds no new
 * dependency to the build.
 */
@Component
@RequiredArgsConstructor
public class FeatureGuardInterceptor implements HandlerInterceptor {

    private final EntitlementService entitlementService;
    private final BillingErrorWriter errorWriter;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        if (!(handler instanceof HandlerMethod handlerMethod)) {
            return true;
        }
        RequiresFeature required = AnnotatedElementUtils.findMergedAnnotation(handlerMethod.getMethod(), RequiresFeature.class);
        if (required == null) {
            required = AnnotatedElementUtils.findMergedAnnotation(handlerMethod.getBeanType(), RequiresFeature.class);
        }
        if (required == null) {
            return true;
        }
        if (!required.gateReads() && "GET".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        Long tenantId = TenantContext.get();
        if (tenantId == null) {
            return true; // pre-tenant paths (provisioning, refresh) carry no entitlement to check
        }

        Entitlements entitlements = entitlementService.forTenant(tenantId);
        Feature feature = required.value();
        if (entitlements.has(feature)) {
            return true;
        }

        errorWriter.write(response, HttpServletResponse.SC_FORBIDDEN, "FEATURE_NOT_INCLUDED",
                "ميزة " + feature.getDisplayNameAr() + " غير مشمولة في باقتك الحالية. يرجى ترقية الباقة.",
                entitlements.planCode());
        return false;
    }
}
