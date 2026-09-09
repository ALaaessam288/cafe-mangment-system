package com.example.cafemangmentsystem.common.idempotency;

import com.example.cafemangmentsystem.common.entity.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * A completed financial operation, kept so a repeat of the same request replays its answer instead
 * of performing the work twice.
 *
 * <p>This lived in a {@code ConcurrentHashMap} on the heap. That protects a single process for as
 * long as it happens to stay up: the guard vanished on every deploy and never applied across two
 * instances at all — so a checkout retried through a restart, or landing on the other node, charged
 * the customer a second time.
 *
 * <p>The row is written inside the same transaction as the work it describes, which is what makes
 * the guard honest: if the checkout rolls back, so does its key, and the request is correctly
 * retryable.
 */
@Entity
@Table(
        name = "idempotency_records",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_idempotency_tenant_key",
                columnNames = {"tenant_id", "idempotency_key"}))
@Getter
@Setter
@NoArgsConstructor
public class IdempotencyRecord extends TenantScopedEntity {

    @Column(name = "idempotency_key", nullable = false, length = 200)
    private String key;

    /** Fully-qualified type of the stored response, so it can be read back as what it was. */
    @Column(name = "response_type", nullable = false, length = 300)
    private String responseType;

    @Column(name = "response_json", nullable = false, columnDefinition = "TEXT")
    private String responseJson;

    @Column(name = "created_at_utc", nullable = false)
    private Instant createdAtUtc;
}
