package com.example.cafemangmentsystem.auth.dto;

import com.example.cafemangmentsystem.billing.dto.AccessLevel;
import com.example.cafemangmentsystem.billing.dto.Entitlements;
import com.example.cafemangmentsystem.billing.entity.QuotaType;
import com.example.cafemangmentsystem.billing.entity.SubscriptionStatus;
import com.example.cafemangmentsystem.tenant.entity.Tenant;

import java.util.List;

/**
 * What the client gets at sign-in.
 *
 * <p>The subscription half used to be eighteen flat fields — plan name, two different end dates,
 * three limits, and one boolean per feature — assembled by hand at four call sites that each had
 * their own null-handling. It is now one {@link Subscription} block built from the same
 * {@link Entitlements} snapshot the server enforces with, so the client can never be told it has
 * something the guard will refuse.
 */
public record LoginResponse(
        String token,
        String tokenType,
        String refreshToken,
        Long userId,
        String username,
        String fullName,
        String role,
        String tenantName,
        String tenantSlug,
        String logoUrl,
        boolean planSelected,
        Subscription subscription
) {

    public record Subscription(
            String planCode,
            String planName,
            SubscriptionStatus status,
            AccessLevel accessLevel,
            Long daysRemaining,
            boolean perpetual,
            boolean inGrace,
            java.time.Instant periodEnd,
            int maxTables,
            int maxUsers,
            int maxProducts,
            List<String> features
    ) {
        public static Subscription from(Entitlements entitlements) {
            return new Subscription(
                    entitlements.planCode(),
                    entitlements.planName(),
                    entitlements.status(),
                    entitlements.accessLevel(),
                    entitlements.daysRemaining(),
                    entitlements.perpetual(),
                    entitlements.inGrace(),
                    entitlements.periodEnd(),
                    entitlements.limit(QuotaType.TABLES),
                    entitlements.limit(QuotaType.USERS),
                    entitlements.limit(QuotaType.PRODUCTS),
                    entitlements.features().stream().map(Enum::name).toList()
            );
        }
    }

    public static LoginResponse of(String token, String refreshToken, Long userId, String username,
                                   String fullName, String role, Tenant tenant, Entitlements entitlements) {
        return new LoginResponse(
                token, "Bearer", refreshToken, userId, username, fullName, role,
                tenant != null ? tenant.getName() : null,
                tenant != null ? tenant.getSlug() : null,
                tenant != null ? tenant.getLogoUrl() : null,
                tenant != null && Boolean.TRUE.equals(tenant.getPlanSelected()),
                Subscription.from(entitlements)
        );
    }
}
