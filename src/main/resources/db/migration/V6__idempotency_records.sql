-- Durable idempotency keys.
--
-- These lived in a ConcurrentHashMap on the heap, which protects a single process for as long as it
-- happens to stay up. The guard vanished on every deploy and never applied across two instances at
-- all — so a checkout retried through a restart, or landing on the other node, charged the customer
-- a second time. Those are exactly the two moments a client is most likely to retry.
--
-- Entity: com.example.cafemangmentsystem.common.idempotency.IdempotencyRecord (extends TenantScopedEntity)
CREATE TABLE IF NOT EXISTS idempotency_records (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    version BIGINT NOT NULL DEFAULT 0,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    idempotency_key VARCHAR(200) NOT NULL,
    -- The response is replayed as the type it was, so both are stored.
    response_type VARCHAR(300) NOT NULL,
    response_json TEXT NOT NULL,
    created_at_utc TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- A key is unique within a tenant, never globally: two cafés generating the same client-side
    -- key must not collide, and one café replaying its own key must.
    CONSTRAINT uq_idempotency_tenant_key UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_tenant ON idempotency_records(tenant_id);
-- The nightly purge scans by age.
CREATE INDEX IF NOT EXISTS idx_idempotency_created ON idempotency_records(created_at_utc);
