package com.example.cafemangmentsystem.auth.dto;

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
        String subscriptionPlan,
        String planDisplayName,
        java.time.Instant trialEndsAt,
        java.time.Instant subscriptionEndsAt,
        Integer maxTables,
        Integer maxUsers,
        Integer maxProducts,
        Boolean includesKds,
        Boolean includesExpenses,
        String logoUrl,
        Boolean planSelected
) {
}