-- Raw-material stock ledger.
--
-- Finished products have had `stock_adjustments` since the beginning. Raw materials had nothing:
-- their balance was changed by overwriting `shift_audit_items.stock_quantity`, so a purchase, a
-- spillage and a typo were indistinguishable after the fact, and the cost of what was bought was
-- never recorded at all. Cost of goods sold is derived from these balances, so every margin the
-- system reports rested on numbers with no provenance.
--
-- Entity: com.example.cafemangmentsystem.inventory.entity.RawMaterialMovement (extends TenantScopedEntity)
CREATE TABLE IF NOT EXISTS raw_material_movements (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    version BIGINT NOT NULL DEFAULT 0,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    audit_item_id BIGINT NOT NULL REFERENCES shift_audit_items(id) ON DELETE CASCADE,
    type VARCHAR(32) NOT NULL,

    -- Signed, in the material's own unit. Positive is stock arriving.
    quantity_change DOUBLE PRECISION NOT NULL,
    -- The balance after this row was applied, so the ledger reads without replaying from zero.
    resulting_quantity DOUBLE PRECISION NOT NULL,

    -- Only a purchase carries a cost; a recount leaves these null rather than pretending to zero.
    unit_cost NUMERIC(12, 4),
    total_cost NUMERIC(14, 2),

    reason VARCHAR(500),
    reference VARCHAR(120),
    shift_id BIGINT REFERENCES shifts(id) ON DELETE SET NULL,
    performed_by VARCHAR(120),
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_rmm_type CHECK (type IN
        ('RESTOCK', 'WASTE', 'CORRECTION', 'AUDIT_OPENING', 'AUDIT_CLOSING'))
);

CREATE INDEX IF NOT EXISTS idx_rmm_tenant ON raw_material_movements(tenant_id);
-- The ledger is almost always read as "this material, newest first".
CREATE INDEX IF NOT EXISTS idx_rmm_item_time ON raw_material_movements(audit_item_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_rmm_shift ON raw_material_movements(shift_id);
-- Purchase totals over a period, for cost of goods sold.
CREATE INDEX IF NOT EXISTS idx_rmm_type_time ON raw_material_movements(type, occurred_at);
