package com.example.cafemangmentsystem.license;

import java.time.Instant;

/**
 * Answer to "is this key worth anything?", safe to return to an unauthenticated caller — it names
 * the plan and the duration on offer but never leaks who redeemed it or what they paid.
 */
public record LicenseKeyValidationResult(
        boolean valid,
        String reason,
        String planCode,
        String planName,
        Integer durationDays,
        boolean perpetual,
        Instant redeemableUntil,
        Integer activationsRemaining
) {
    public static LicenseKeyValidationResult invalid(String reason) {
        return new LicenseKeyValidationResult(false, reason, null, null, null, false, null, null);
    }

    public static LicenseKeyValidationResult valid(LicenseKey key, int activationsUsed) {
        return new LicenseKeyValidationResult(
                true,
                null,
                key.getPlan().getCode(),
                key.getPlan().getDisplayNameAr(),
                key.isPerpetual() ? null : key.getDurationDays(),
                key.isPerpetual(),
                key.getRedeemableUntil(),
                Math.max(0, key.getMaxActivations() - activationsUsed)
        );
    }
}
