package com.example.cafemangmentsystem.billing.dto;

import com.example.cafemangmentsystem.billing.entity.SubscriptionStatus;
import com.example.cafemangmentsystem.billing.entity.TenantSubscription;

import java.math.BigDecimal;
import java.time.Instant;

public record SubscriptionDto(
        Long id,
        Long tenantId,
        String planCode,
        String planName,
        SubscriptionStatus status,
        String source,
        Instant startedAt,
        Instant currentPeriodStart,
        Instant currentPeriodEnd,
        Instant graceEndsAt,
        boolean perpetual,
        BigDecimal price,
        String currency,
        boolean autoRenew,
        Integer overrideMaxTables,
        Integer overrideMaxUsers,
        Integer overrideMaxProducts,
        Integer graceDays,
        Instant cancelledAt,
        String cancelReason,
        String notes
) {
    public static SubscriptionDto from(TenantSubscription subscription) {
        return new SubscriptionDto(
                subscription.getId(),
                subscription.getTenantId(),
                subscription.getPlan().getCode(),
                subscription.getPlan().getDisplayNameAr(),
                subscription.getStatus(),
                subscription.getSource().name(),
                subscription.getStartedAt(),
                subscription.getCurrentPeriodStart(),
                subscription.getCurrentPeriodEnd(),
                subscription.getGraceEndsAt(),
                subscription.isPerpetual(),
                subscription.getPriceAtPurchase(),
                subscription.getCurrency(),
                subscription.isAutoRenew(),
                subscription.getOverrideMaxTables(),
                subscription.getOverrideMaxUsers(),
                subscription.getOverrideMaxProducts(),
                subscription.getGraceDays(),
                subscription.getCancelledAt(),
                subscription.getCancelReason(),
                subscription.getNotes()
        );
    }
}
