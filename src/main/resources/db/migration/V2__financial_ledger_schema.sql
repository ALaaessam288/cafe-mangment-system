-- V2: Financial Ledger Entries Schema
--
-- Matches com.example.cafemangmentsystem.ledger.entity.FinancialLedgerEntry, which extends
-- BaseEntity (not TenantScopedEntity) - it has no tenant_id column. A tenant_id column and index
-- here previously didn't match the entity; with JPA_DDL_AUTO=update in production, Hibernate had
-- already created this table from the entity mapping (so no tenant_id), which made this script's
-- CREATE TABLE a no-op and its CREATE INDEX ON tenant_id fail with "column does not exist".
CREATE TABLE IF NOT EXISTS financial_ledger_entries (
    id ${pk_id},
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
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    version BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_ledger_occurred ON financial_ledger_entries (occurred_at);
CREATE INDEX IF NOT EXISTS idx_ledger_shift ON financial_ledger_entries (shift_id);
