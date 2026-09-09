package com.example.cafemangmentsystem.tenant.repository;

import com.example.cafemangmentsystem.tenant.entity.Tenant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Optional;

/**
 * Paged, filtered tenant queries are built as specifications in the service — see
 * {@code TenantActivityLogRepository} for why an {@code :param IS NULL OR ...} JPQL query is a trap
 * on PostgreSQL.
 */
public interface TenantRepository extends JpaRepository<Tenant, Long>, JpaSpecificationExecutor<Tenant> {

    Optional<Tenant> findBySlug(String slug);

    boolean existsBySlug(String slug);
}
