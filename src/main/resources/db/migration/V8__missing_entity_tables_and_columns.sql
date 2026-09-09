-- Schema that four JPA entities expect and no migration ever created.
--
-- Found by applying V1–V7 to a real PostgreSQL instance and diffing every @Entity's mapped columns
-- against information_schema. All four went unnoticed for the same reason: the desktop build runs
-- SQLite with JPA_DDL_AUTO=update, where Hibernate quietly creates whatever is missing. A server
-- deployment runs ddl-auto=none and migrations own the schema, so each of these is a hard failure
-- the first time the feature is touched.
--
-- cash_movements is the drawer ledger (float, cash in, safe drop, cash out).
-- manager_overrides is the supervisor-PIN audit trail — the record written every time a line or a
-- whole order is voided. Without it, voiding an order fails outright on a server deployment.

-- ── cash_movements ───────────────────────────────────────────────────────────
-- Entity: com.example.cafemangmentsystem.cashmovement.entity.CashMovement (extends TenantScopedEntity)
CREATE TABLE IF NOT EXISTS cash_movements (
    id ${pk_id},
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    version BIGINT NOT NULL DEFAULT 0,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    shift_id BIGINT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
    register_id BIGINT REFERENCES registers(id),
    performed_by BIGINT NOT NULL REFERENCES users(id),

    type VARCHAR(50) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    reason VARCHAR(500),
    receipt_number VARCHAR(255),
    performed_at TIMESTAMP WITH TIME ZONE NOT NULL,

    CONSTRAINT chk_cash_movement_type CHECK (type IN ('FLOAT', 'CASH_IN', 'SAFE_DROP', 'CASH_OUT'))
);

CREATE INDEX IF NOT EXISTS idx_cash_movements_tenant ON cash_movements(tenant_id);
-- Reconciling a drawer reads one shift at a time.
CREATE INDEX IF NOT EXISTS idx_cash_movements_shift ON cash_movements(shift_id);

-- ── manager_overrides ────────────────────────────────────────────────────────
-- Entity: com.example.cafemangmentsystem.manageroverride.entity.ManagerOverride (extends TenantScopedEntity)
--
-- order_id and shift_id are plain BIGINT with no foreign key, matching the entity: the audit row
-- must outlive whatever it refers to. An override that vanishes when its order is purged is not an
-- audit trail.
CREATE TABLE IF NOT EXISTS manager_overrides (
    id ${pk_id},
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    version BIGINT NOT NULL DEFAULT 0,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    supervisor_id BIGINT NOT NULL REFERENCES users(id),
    cashier_id BIGINT REFERENCES users(id),

    action_type VARCHAR(255) NOT NULL,
    order_id BIGINT,
    shift_id BIGINT,
    amount NUMERIC(10, 2),
    reason VARCHAR(500) NOT NULL,
    details VARCHAR(1000),
    performed_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_manager_overrides_tenant ON manager_overrides(tenant_id);
CREATE INDEX IF NOT EXISTS idx_manager_overrides_time ON manager_overrides(performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_manager_overrides_order ON manager_overrides(order_id);

-- ── two columns the entities map and the tables lack ─────────────────────────
-- Expense.spenderName: who physically took the money, which is not always the user who recorded it.
ALTER TABLE expenses ADD COLUMN ${add_col_if_not_exists}spender_name VARCHAR(255);
-- Payment.note: the free-text line a cashier attaches to a payment.
ALTER TABLE payments ADD COLUMN ${add_col_if_not_exists}note VARCHAR(255);
