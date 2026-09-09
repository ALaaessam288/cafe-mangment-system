package com.example.cafemangmentsystem.tenant.repository;

import com.example.cafemangmentsystem.tenant.entity.TenantActivityLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

/**
 * Audit log access.
 *
 * <p>Filtered search goes through {@link JpaSpecificationExecutor} rather than a JPQL query full of
 * {@code :param IS NULL OR ...} branches. Those read tidily but bind a null of unknown type, and
 * PostgreSQL refuses to guess — "could not determine data type of parameter $5". A specification
 * simply omits the predicate when a filter is absent, so nothing untyped is ever bound.
 */
public interface TenantActivityLogRepository
        extends JpaRepository<TenantActivityLog, Long>, JpaSpecificationExecutor<TenantActivityLog> {

    List<TenantActivityLog> findByTenantIdOrderByCreatedAtDesc(Long tenantId);

    /** Kept for the dashboard's "latest activity" strip, which genuinely wants only a handful. */
    List<TenantActivityLog> findTop200ByOrderByCreatedAtDesc();

    /** Distinct action codes actually present, so the filter dropdown reflects reality. */
    @Query("SELECT DISTINCT l.action FROM TenantActivityLog l ORDER BY l.action")
    List<String> findDistinctActions();
}
