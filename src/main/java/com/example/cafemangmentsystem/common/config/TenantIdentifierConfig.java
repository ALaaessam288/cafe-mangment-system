package com.example.cafemangmentsystem.common.config;

import com.example.cafemangmentsystem.common.tenant.TenantContext;
import org.hibernate.cfg.MultiTenancySettings;
import org.hibernate.context.spi.CurrentTenantIdentifierResolver;
import org.springframework.boot.hibernate.autoconfigure.HibernatePropertiesCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Wires {@link TenantContext} into Hibernate's native discriminator-based multi-tenancy
 * (entities carrying {@code @TenantId}, see {@code TenantScopedEntity}). Every read/write for
 * those entities is transparently restricted to the resolved tenant - resolved fresh per query
 * via this callback, so it's immune to session-identity mismatches (unlike the older
 * session-scoped {@code @Filter} approach, which requires the exact same Hibernate Session to be
 * reused for both "enable" and the actual query - not guaranteed once a servlet Filter and a
 * later controller/service call end up on different Spring-managed EntityManagers).
 * <p>
 * Hibernate requires a session-opening tenant identifier to always be non-null, so an unset
 * {@link TenantContext} resolves to {@link #ROOT} rather than null; {@link #isRoot} tells
 * Hibernate to skip tenant filtering entirely for that sentinel. This only matters for the
 * handful of legitimate pre-tenant paths (refresh-token rotation, tenant provisioning's own
 * setup work, app startup) - every normal authenticated request has the context set by
 * {@code JwtAuthenticationFilter} first.
 */
@Configuration
public class TenantIdentifierConfig {

    private static final Long ROOT = 0L;

    @Bean
    public CurrentTenantIdentifierResolver<Long> currentTenantIdentifierResolver() {
        return new CurrentTenantIdentifierResolver<>() {
            @Override
            public Long resolveCurrentTenantIdentifier() {
                Long tenantId = TenantContext.get();
                return tenantId == null ? ROOT : tenantId;
            }

            @Override
            public boolean validateExistingCurrentSessions() {
                return true;
            }

            @Override
            public boolean isRoot(Long tenantId) {
                return ROOT.equals(tenantId);
            }
        };
    }

    @Bean
    public HibernatePropertiesCustomizer tenantIdentifierResolverCustomizer(
            CurrentTenantIdentifierResolver<Long> resolver) {
        return properties -> properties.put(MultiTenancySettings.MULTI_TENANT_IDENTIFIER_RESOLVER, resolver);
    }
}
