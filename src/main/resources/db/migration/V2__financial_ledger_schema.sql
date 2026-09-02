-- V2: Financial Ledger Entries Schema
CREATE TABLE IF NOT EXISTS financial_ledger_entries (
    id BIGINT PRIMARY KEY,
    tenant_id BIGINT NOT NULL,
    entry_type VARCHAR(50) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    debit_account VARCHAR(50) NOT NULL,
    credit_account VARCHAR(50) NOT NULL,
    reference_type VARCHAR(50),
    reference_id BIGINT,
    shift_id BIGINT,
    performed_by_id BIGINT,
    occurred_at TIMESTAMP NOT NULL,
    notes TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ledger_tenant_occurred ON financial_ledger_entries (tenant_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_ledger_shift ON financial_ledger_entries (shift_id);
