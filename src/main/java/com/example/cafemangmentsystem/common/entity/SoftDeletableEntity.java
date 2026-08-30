package com.example.cafemangmentsystem.common.entity;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import lombok.Getter;

import java.time.Instant;

@Getter
@MappedSuperclass
public abstract class SoftDeletableEntity extends TenantScopedEntity {

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @Column(name = "deleted_by")
    private Long deletedBy;

    public void activate() {
        this.active = true;
        this.deletedAt = null;
        this.deletedBy = null;
    }

    public void deactivate(Long deletedByUserId) {
        this.active = false;
        this.deletedAt = Instant.now();
        this.deletedBy = deletedByUserId;
    }

    public void deactivate() {
        deactivate(null);
    }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }

    public Instant getDeletedAt() { return deletedAt; }
    public void setDeletedAt(Instant deletedAt) { this.deletedAt = deletedAt; }

    public Long getDeletedBy() { return deletedBy; }
    public void setDeletedBy(Long deletedBy) { this.deletedBy = deletedBy; }
}