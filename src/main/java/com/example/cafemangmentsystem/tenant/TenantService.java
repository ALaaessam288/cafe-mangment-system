package com.example.cafemangmentsystem.tenant;

import com.example.cafemangmentsystem.common.tenant.TenantContext;
import com.example.cafemangmentsystem.tenant.dto.TenantResponse;
import com.example.cafemangmentsystem.tenant.entity.Tenant;
import com.example.cafemangmentsystem.tenant.entity.TenantStatus;
import com.example.cafemangmentsystem.tenant.platform.TenantOwnerProvisioner;
import com.example.cafemangmentsystem.tenant.platform.dto.ProvisionTenantRequest;
import com.example.cafemangmentsystem.tenant.platform.dto.ProvisionTenantResponse;
import com.example.cafemangmentsystem.tenant.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Set;

@Service
@RequiredArgsConstructor
@Transactional
public class TenantService {

    private static final Set<TenantStatus> LOGINABLE = Set.of(TenantStatus.TRIAL, TenantStatus.ACTIVE);

    private final TenantRepository tenantRepository;
    private final TenantOwnerProvisioner tenantOwnerProvisioner;

    /**
     * Resolves a tenant for login. Deliberately throws the same {@link BadCredentialsException}
     * for "no such slug" and "tenant not loginable" as a wrong password would - AuthController's
     * existing handler turns that into a generic 401, so we never reveal whether it was the
     * tenant, the username, or the password that was wrong.
     */
    @Transactional(readOnly = true)
    public Tenant resolveLoginableTenant(String slug) {
        Tenant tenant = tenantRepository.findBySlug(slug)
                .orElseThrow(() -> new BadCredentialsException("Unknown tenant"));
        if (!LOGINABLE.contains(tenant.getStatus())) {
            throw new BadCredentialsException("Tenant is not active");
        }
        return tenant;
    }

    @Transactional(readOnly = true)
    public TenantResponse findById(Long id) {
        return tenantRepository.findById(id)
                .map(TenantResponse::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tenant not found: " + id));
    }

    public ProvisionTenantResponse provision(ProvisionTenantRequest request) {
        if (tenantRepository.existsBySlug(request.slug())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Slug already taken: " + request.slug());
        }

        Tenant tenant = Tenant.builder()
                .name(request.name())
                .slug(request.slug())
                .businessType(request.businessType())
                .status(TenantStatus.TRIAL)
                .timezone(request.timezone() == null ? "UTC" : request.timezone())
                .currency(request.currency() == null ? "USD" : request.currency())
                .build();
        tenant = tenantRepository.save(tenant);

        // Set before calling into the REQUIRES_NEW bean: that call opens a brand new Hibernate
        // session, and @TenantId resolves the tenant identifier at session-open time - it has to
        // already be correct by the time that happens, not set from inside the callee.
        TenantContext.set(tenant.getId());
        try {
            tenantOwnerProvisioner.createOwner(request.ownerUsername(), request.ownerFullName(), request.ownerPassword());
        } finally {
            TenantContext.clear();
        }

        return new ProvisionTenantResponse(tenant.getId(), tenant.getSlug(), request.ownerUsername());
    }
}
