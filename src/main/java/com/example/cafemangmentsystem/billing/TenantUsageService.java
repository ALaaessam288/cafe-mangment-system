package com.example.cafemangmentsystem.billing;

import com.example.cafemangmentsystem.billing.dto.Entitlements;
import com.example.cafemangmentsystem.billing.dto.PlanDto;
import com.example.cafemangmentsystem.billing.dto.TenantUsageDto;
import com.example.cafemangmentsystem.billing.entity.QuotaType;
import com.example.cafemangmentsystem.cafetable.repository.CafeTableRepository;
import com.example.cafemangmentsystem.common.tenant.TenantContext;
import com.example.cafemangmentsystem.menu.repository.ProductRepository;
import com.example.cafemangmentsystem.tenant.entity.Tenant;
import com.example.cafemangmentsystem.tenant.repository.TenantRepository;
import com.example.cafemangmentsystem.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.function.Supplier;

/**
 * Builds the usage picture for one tenant.
 *
 * <p>The counts come from tenant-scoped repositories, which Hibernate filters by whatever tenant is
 * in {@link TenantContext} — <em>not</em> by the id passed in. The old platform code that reached
 * for {@code getTenantUsageDetails(otherTenantId)} would therefore have reported the caller's own
 * counts against the target's limits. {@link #forTenant} makes the scope explicit by running the
 * counts inside the target tenant's context and restoring the caller's afterwards.
 */
@Service
@RequiredArgsConstructor
public class TenantUsageService {

    private final TenantRepository tenantRepository;
    private final CafeTableRepository cafeTableRepository;
    private final UserRepository userRepository;
    private final ProductRepository productRepository;
    private final EntitlementService entitlementService;

    @Transactional(readOnly = true)
    public TenantUsageDto forTenant(Long tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tenant not found: " + tenantId));

        Entitlements entitlements = entitlementService.forTenant(tenantId);

        long tables = inTenantScope(tenantId, cafeTableRepository::count);
        long users = inTenantScope(tenantId, userRepository::count);
        long products = inTenantScope(tenantId, productRepository::count);

        List<TenantUsageDto.QuotaUsage> quotas = List.of(
                TenantUsageDto.QuotaUsage.of(QuotaType.TABLES, tables, entitlements.limit(QuotaType.TABLES)),
                TenantUsageDto.QuotaUsage.of(QuotaType.USERS, users, entitlements.limit(QuotaType.USERS)),
                TenantUsageDto.QuotaUsage.of(QuotaType.PRODUCTS, products, entitlements.limit(QuotaType.PRODUCTS))
        );

        return new TenantUsageDto(
                tenant.getId(),
                tenant.getName(),
                tenant.getSlug(),
                entitlements.planCode(),
                entitlements.planName(),
                entitlements.status(),
                entitlements.accessLevel(),
                quotas,
                entitlements.features().stream().map(PlanDto.FeatureDto::of).toList(),
                entitlements.daysRemaining(),
                entitlements.perpetual(),
                entitlements.inGrace(),
                entitlements.periodEnd(),
                entitlements.graceEndsAt()
        );
    }

    /** Runs a tenant-scoped read as the given tenant, then restores the caller's context. */
    private <T> T inTenantScope(Long tenantId, Supplier<T> work) {
        Long previous = TenantContext.get();
        try {
            TenantContext.set(tenantId);
            return work.get();
        } finally {
            if (previous != null) {
                TenantContext.set(previous);
            } else {
                TenantContext.clear();
            }
        }
    }
}
