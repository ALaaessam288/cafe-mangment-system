package com.example.cafemangmentsystem.common.tenant;

/**
 * Per-request current-tenant holder. Set by {@code JwtAuthenticationFilter} (and explicitly
 * by the login and tenant-provisioning flows, which run before any JWT exists) and read by
 * {@link com.example.cafemangmentsystem.common.config.TenantIdentifierConfig}'s
 * {@code CurrentTenantIdentifierResolver} to scope every tenant-owned entity automatically.
 * <p>
 * Unset (null) means "root" - no tenant restriction is applied. That only happens in the few
 * bootstrap paths that must legitimately cross tenants before one is known (refresh-token
 * rotation, tenant provisioning's own setup work). Every normal authenticated request always
 * has this set before touching tenant-scoped data.
 */
public final class TenantContext {

    private static final ThreadLocal<Long> CURRENT = new ThreadLocal<>();

    private TenantContext() {
    }

    public static void set(Long tenantId) {
        CURRENT.set(tenantId);
    }

    public static Long get() {
        return CURRENT.get();
    }

    public static void clear() {
        CURRENT.remove();
    }
}
