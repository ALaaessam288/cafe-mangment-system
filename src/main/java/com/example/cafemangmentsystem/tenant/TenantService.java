package com.example.cafemangmentsystem.tenant;

import com.example.cafemangmentsystem.common.tenant.TenantContext;
import com.example.cafemangmentsystem.tenant.dto.TenantResponse;
import com.example.cafemangmentsystem.tenant.entity.Tenant;
import com.example.cafemangmentsystem.tenant.entity.TenantStatus;
import com.example.cafemangmentsystem.tenant.dto.PublicTenantDto;
import com.example.cafemangmentsystem.tenant.platform.TenantOwnerProvisioner;
import com.example.cafemangmentsystem.tenant.platform.TenantSaver;
import com.example.cafemangmentsystem.tenant.platform.dto.ProvisionTenantRequest;
import com.example.cafemangmentsystem.tenant.platform.dto.ProvisionTenantResponse;
import com.example.cafemangmentsystem.tenant.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class TenantService {

    private static final Set<TenantStatus> LOGINABLE = Set.of(TenantStatus.TRIAL, TenantStatus.ACTIVE);

    private final TenantRepository tenantRepository;
    private final TenantOwnerProvisioner tenantOwnerProvisioner;
    private final TenantSaver tenantSaver;

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

    @Transactional(readOnly = true)
    public List<PublicTenantDto> findAllPublic() {
        return tenantRepository.findAll().stream()
                .filter(t -> LOGINABLE.contains(t.getStatus()))
                .map(t -> new PublicTenantDto(t.getSlug(), t.getName(), t.getBusinessType().name()))
                .collect(Collectors.toList());
    }

    /**
     * Provisions a new tenant + its owner user.
     *
     * SQLite is single-writer: two concurrent transactions cause SQLITE_BUSY.
     * We must NOT hold an outer transaction while calling sub-transactions, so
     * this method runs with NOT_SUPPORTED (suspends any ambient transaction).
     *
     * Sequence (each step commits fully before the next opens a connection):
     *   1. TenantSaver.existsBySlug()  — REQUIRES_NEW → commits → releases lock
     *   2. TenantSaver.save()          — REQUIRES_NEW → commits → releases lock
     *   3. TenantContext.set(tenantId) — no DB work
     *   4. TenantOwnerProvisioner      — REQUIRES_NEW → commits → releases lock
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public ProvisionTenantResponse provision(ProvisionTenantRequest request) {
        if (tenantSaver.existsBySlug(request.slug())) {
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

        // Step 1: save tenant in its own transaction → commits, releases SQLite write lock
        tenant = tenantSaver.save(tenant);

        // Step 2: set tenant context so Hibernate stamps correct tenant_id on the user INSERT
        TenantContext.set(tenant.getId());
        try {
            // Step 3: save owner in its own transaction → commits, releases SQLite write lock
            tenantOwnerProvisioner.createOwner(
                    request.ownerUsername(), request.ownerFullName(), request.ownerPassword());
        } finally {
            TenantContext.clear();
        }

        return new ProvisionTenantResponse(tenant.getId(), tenant.getSlug(), request.ownerUsername());
    }
}
