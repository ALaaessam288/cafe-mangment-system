package com.example.cafemangmentsystem.common.entity;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import lombok.Getter;
import org.hibernate.annotations.TenantId;

/**
 * Base for every tenant-owned entity. {@code @TenantId} makes Hibernate transparently restrict
 * every read/update/delete to the current tenant AND auto-stamp {@code tenantId} on insert - both
 * driven, per query, by {@code CurrentTenantIdentifierResolver} (see
 * {@code TenantIdentifierConfig}), which reads {@link com.example.cafemangmentsystem.common.tenant.TenantContext}.
 * <p>
 * Resolved live per query rather than "enabled on a session once" - unlike Hibernate's older
 * {@code @Filter} mechanism, this doesn't depend on the same physical Hibernate Session being
 * reused across a request (which, with Spring's open-in-view, is only guaranteed from the
 * controller layer onward - servlet filters like the JWT auth filter run earlier and don't share
 * that session).
 */
@Getter
@MappedSuperclass
public abstract class TenantScopedEntity extends BaseEntity {

    @TenantId
    @Column(name = "tenant_id", nullable = false, updatable = false)
    private Long tenantId;

    public Long getTenantId() { return tenantId; }
    public void setTenantId(Long tenantId) { this.tenantId = tenantId; }
}
