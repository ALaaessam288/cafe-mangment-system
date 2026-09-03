-- V4: Bank-transfer upgrade requests
--
-- There is no payment gateway: a café transfers the money and the platform confirms it. That flow
-- previously existed only as a WhatsApp link on the settings page, so an upgrade left no record —
-- nobody could see which requests were outstanding, and the transfer reference lived in a chat.

CREATE TABLE IF NOT EXISTS upgrade_requests (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    version BIGINT NOT NULL DEFAULT 0,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    -- Plan code rather than a FK: a request may outlive the plan it named.
    requested_plan_code VARCHAR(40) NOT NULL,
    requested_period_days INT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    quoted_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency VARCHAR(8) NOT NULL DEFAULT 'EGP',
    contact_name VARCHAR(120),
    contact_phone VARCHAR(40),
    transfer_reference VARCHAR(120),
    customer_note VARCHAR(500),
    submitted_by VARCHAR(120),
    reviewed_by VARCHAR(120),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_note VARCHAR(500),
    settled_amount NUMERIC(12,2),
    invoice_id BIGINT
);

CREATE INDEX IF NOT EXISTS idx_upgrade_requests_tenant ON upgrade_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_upgrade_requests_status ON upgrade_requests(status);

-- One open request per tenant, enforced here rather than trusted to the service layer: a customer
-- double-clicking would otherwise create two, and whoever reviews them approves both — two periods
-- and two invoices raised against a single transfer.
CREATE UNIQUE INDEX IF NOT EXISTS uk_upgrade_requests_one_open
    ON upgrade_requests(tenant_id) WHERE status = 'PENDING';
