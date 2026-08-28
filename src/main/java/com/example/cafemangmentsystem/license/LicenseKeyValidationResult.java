package com.example.cafemangmentsystem.license;

import com.example.cafemangmentsystem.tenant.entity.SubscriptionPlan;

public record LicenseKeyValidationResult(
        boolean valid,
        String errorCode,
        String key,
        SubscriptionPlan plan,
        String planDisplayName
) {
    public static LicenseKeyValidationResult valid(LicenseKey lk) {
        return new LicenseKeyValidationResult(true, null, lk.getKey(),
                lk.getPlan(), lk.getPlan().getDisplayName());
    }

    public static LicenseKeyValidationResult invalid(String errorCode) {
        return new LicenseKeyValidationResult(false, errorCode, null, null, null);
    }
}
