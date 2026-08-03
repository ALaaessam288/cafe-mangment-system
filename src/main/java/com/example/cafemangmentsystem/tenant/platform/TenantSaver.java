package com.example.cafemangmentsystem.tenant.platform;

import com.example.cafemangmentsystem.tenant.entity.Tenant;
import com.example.cafemangmentsystem.tenant.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Saves a Tenant in its own REQUIRES_NEW transaction so it commits and releases
 * the SQLite write lock before TenantOwnerProvisioner opens its own transaction.
 * SQLite is single-writer; two concurrent transactions from the same process
 * cause SQLITE_BUSY. Committing the tenant first (here) then creating the user
 * (in TenantOwnerProvisioner) makes both writes fully sequential.
 */
@Component
@RequiredArgsConstructor
public class TenantSaver {

    private final TenantRepository tenantRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Tenant save(Tenant tenant) {
        return tenantRepository.save(tenant);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean existsBySlug(String slug) {
        return tenantRepository.existsBySlug(slug);
    }
}
