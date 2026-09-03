-- V3: Billing subsystem
--
-- Replaces the enum-backed subscription model with real tables:
--   plans / plan_features        the sellable catalogue, editable without a release
--   tenant_subscriptions         one current row per tenant, the rest is history
--   subscription_invoices        what a tenant was billed, with the price frozen at issue
--   subscription_payments        what actually arrived
--   license_key_activations      one row per redemption, so single-use keys really are single-use
--
-- The tenants table loses subscription_plan, trial_ends_at, subscription_ends_at and the three
-- max_* columns; everything in them is carried into tenant_subscriptions first.
--
-- Also creates license_keys, which the entity model has always had but V1 never declared — on
-- Postgres with ddl-auto=validate the application could not start.

-- ── Catalogue ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS plans (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    version BIGINT NOT NULL DEFAULT 0,
    code VARCHAR(40) NOT NULL UNIQUE,
    display_name_ar VARCHAR(255) NOT NULL,
    display_name_en VARCHAR(255),
    description TEXT,
    price NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency VARCHAR(8) NOT NULL DEFAULT 'EGP',
    billing_period_days INT NOT NULL DEFAULT 30,
    trial_days INT NOT NULL DEFAULT 0,
    -- -1 means unlimited. The old model used 9999, which the quota checker enforced as a real cap.
    max_tables INT NOT NULL,
    max_users INT NOT NULL,
    max_products INT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    self_selectable BOOLEAN NOT NULL DEFAULT FALSE,
    custom_plan BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS plan_features (
    plan_id BIGINT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    feature VARCHAR(40) NOT NULL,
    CONSTRAINT pk_plan_features PRIMARY KEY (plan_id, feature)
);

-- ── Subscriptions ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tenant_subscriptions (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    version BIGINT NOT NULL DEFAULT 0,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id BIGINT NOT NULL REFERENCES plans(id),
    status VARCHAR(30) NOT NULL,
    source VARCHAR(30) NOT NULL,
    current_subscription BOOLEAN NOT NULL DEFAULT TRUE,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE,
    grace_ends_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancel_reason VARCHAR(500),
    price_at_purchase NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency VARCHAR(8) NOT NULL DEFAULT 'EGP',
    auto_renew BOOLEAN NOT NULL DEFAULT FALSE,
    license_key_id BIGINT,
    override_max_tables INT,
    override_max_users INT,
    override_max_products INT,
    grace_days INT,
    notes VARCHAR(500),
    last_warning_days INT
);

CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_tenant ON tenant_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_period_end ON tenant_subscriptions(current_period_end);
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_current ON tenant_subscriptions(tenant_id, current_subscription);

-- "One current subscription per tenant" is an invariant the whole entitlement model rests on,
-- so the database enforces it rather than trusting every write path to remember.
CREATE UNIQUE INDEX IF NOT EXISTS uk_tenant_subscriptions_one_current
    ON tenant_subscriptions(tenant_id) WHERE current_subscription;

-- ── Money ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subscription_invoices (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    version BIGINT NOT NULL DEFAULT 0,
    invoice_number VARCHAR(40) NOT NULL UNIQUE,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    subscription_id BIGINT NOT NULL,
    -- Snapshots, not joins: renaming or repricing a plan must not rewrite an issued invoice.
    plan_code VARCHAR(40) NOT NULL,
    plan_name VARCHAR(255) NOT NULL,
    status VARCHAR(30) NOT NULL,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE,
    issued_at TIMESTAMP WITH TIME ZONE NOT NULL,
    due_at TIMESTAMP WITH TIME ZONE,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency VARCHAR(8) NOT NULL DEFAULT 'EGP',
    paid_at TIMESTAMP WITH TIME ZONE,
    notes VARCHAR(500)
);

CREATE INDEX IF NOT EXISTS idx_subscription_invoices_tenant ON subscription_invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_status ON subscription_invoices(status);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_issued ON subscription_invoices(issued_at);

CREATE TABLE IF NOT EXISTS subscription_payments (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    version BIGINT NOT NULL DEFAULT 0,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    invoice_id BIGINT NOT NULL REFERENCES subscription_invoices(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency VARCHAR(8) NOT NULL DEFAULT 'EGP',
    method VARCHAR(30) NOT NULL,
    reference VARCHAR(120),
    received_at TIMESTAMP WITH TIME ZONE NOT NULL,
    recorded_by VARCHAR(120),
    notes VARCHAR(500)
);

CREATE INDEX IF NOT EXISTS idx_subscription_payments_tenant ON subscription_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_invoice ON subscription_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_received ON subscription_payments(received_at);

-- ── Licence keys ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS license_keys (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    version BIGINT NOT NULL DEFAULT 0,
    license_key VARCHAR(32) NOT NULL UNIQUE,
    plan_id BIGINT NOT NULL REFERENCES plans(id),
    -- How much subscription a redemption grants (0 = perpetual)...
    duration_days INT NOT NULL DEFAULT 30,
    -- ...as opposed to how long the key may be redeemed. One column doing both jobs meant a
    -- year-long key redeemed in month eleven granted six weeks.
    redeemable_until TIMESTAMP WITH TIME ZONE,
    max_activations INT NOT NULL DEFAULT 1,
    activations_count INT NOT NULL DEFAULT 0,
    price NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency VARCHAR(8) NOT NULL DEFAULT 'EGP',
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoke_reason VARCHAR(500),
    notes VARCHAR(500)
);

CREATE INDEX IF NOT EXISTS idx_license_keys_plan ON license_keys(plan_id);

CREATE TABLE IF NOT EXISTS license_key_activations (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    version BIGINT NOT NULL DEFAULT 0,
    license_key_id BIGINT NOT NULL REFERENCES license_keys(id) ON DELETE CASCADE,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    subscription_id BIGINT,
    activated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    activated_by VARCHAR(120),
    -- Second line of defence behind the row lock: the same tenant cannot redeem a key twice.
    CONSTRAINT uk_license_activation_key_tenant UNIQUE (license_key_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_license_activations_key ON license_key_activations(license_key_id);

-- ── Columns V1 never declared but the entities have long carried ────────────

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan_selected BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Seed the catalogue ──────────────────────────────────────────────────────
-- Limits are the ones the server actually enforced. Where the frontend's pricing cards claimed
-- different numbers (PRO advertised 25 tables and unlimited items against a real 50 and 500),
-- the enforced values are the terms customers were really sold, so those carry over.

INSERT INTO plans (code, display_name_ar, display_name_en, price, currency, billing_period_days,
                   trial_days, max_tables, max_users, max_products, sort_order, active,
                   self_selectable, custom_plan)
VALUES
    ('TRIAL',      'فترة تجريبية',        'Free trial',   0.00, 'EGP', 14, 14,    5,   2,   30, 0, TRUE, TRUE,  FALSE),
    ('STARTER',    'الباقة الأساسية',      'Starter',    499.00, 'EGP', 30,  0,   20,   5,  100, 1, TRUE, FALSE, FALSE),
    ('PRO',        'الباقة الاحترافية',    'Professional', 899.00, 'EGP', 30, 0,  50,  15,  500, 2, TRUE, FALSE, FALSE),
    ('ENTERPRISE', 'الباقة الشاملة',       'Enterprise', 1499.00, 'EGP', 30, 0,  -1,  -1,   -1, 3, TRUE, FALSE, FALSE),
    ('CUSTOM',     'باقة مخصصة',          'Custom',       0.00, 'EGP', 30,  0,    1,   1,    1, 4, TRUE, FALSE, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO plan_features (plan_id, feature)
SELECT p.id, f.feature FROM plans p
JOIN (VALUES
    ('TRIAL','POS'), ('TRIAL','THERMAL_PRINT'),

    ('STARTER','POS'), ('STARTER','THERMAL_PRINT'), ('STARTER','EXPENSES'), ('STARTER','DISCOUNTS'),

    ('PRO','POS'), ('PRO','THERMAL_PRINT'), ('PRO','EXPENSES'), ('PRO','DISCOUNTS'),
    ('PRO','KDS'), ('PRO','DEBTS'), ('PRO','INVENTORY'), ('PRO','PAYROLL'),
    ('PRO','REPORTS'), ('PRO','MULTI_REGISTER'), ('PRO','MANAGER_OVERRIDE'), ('PRO','WHATSAPP_ALERTS'),

    ('ENTERPRISE','POS'), ('ENTERPRISE','THERMAL_PRINT'), ('ENTERPRISE','EXPENSES'),
    ('ENTERPRISE','DISCOUNTS'), ('ENTERPRISE','KDS'), ('ENTERPRISE','DEBTS'),
    ('ENTERPRISE','INVENTORY'), ('ENTERPRISE','PAYROLL'), ('ENTERPRISE','REPORTS'),
    ('ENTERPRISE','MULTI_REGISTER'), ('ENTERPRISE','MANAGER_OVERRIDE'),
    ('ENTERPRISE','WHATSAPP_ALERTS'), ('ENTERPRISE','CUSTOM_BRANDING'), ('ENTERPRISE','MULTI_BRANCH'),

    ('CUSTOM','POS'), ('CUSTOM','THERMAL_PRINT'), ('CUSTOM','EXPENSES'), ('CUSTOM','DISCOUNTS'),
    ('CUSTOM','KDS'), ('CUSTOM','DEBTS'), ('CUSTOM','INVENTORY'), ('CUSTOM','PAYROLL'),
    ('CUSTOM','REPORTS'), ('CUSTOM','MULTI_REGISTER'), ('CUSTOM','MANAGER_OVERRIDE'),
    ('CUSTOM','WHATSAPP_ALERTS'), ('CUSTOM','CUSTOM_BRANDING'), ('CUSTOM','MULTI_BRANCH')
) AS f(code, feature) ON f.code = p.code
ON CONFLICT DO NOTHING;

-- ── Carry every existing tenant into a subscription ─────────────────────────
-- Status maps from what the tenant row actually said; the end date comes from whichever of the two
-- old columns was in play for that status, and the per-tenant max_* columns become overrides only
-- where they differed from the plan, so bespoke deals survive and defaults stop being duplicated.

INSERT INTO tenant_subscriptions (
    tenant_id, plan_id, status, source, current_subscription, started_at,
    current_period_start, current_period_end, price_at_purchase, currency,
    override_max_tables, override_max_users, override_max_products, notes
)
SELECT
    t.id,
    p.id,
    CASE
        WHEN t.status = 'SUSPENDED' THEN 'SUSPENDED'
        WHEN t.status = 'CANCELLED' THEN 'CANCELLED'
        WHEN t.status = 'TRIAL' AND (t.trial_ends_at IS NULL OR t.trial_ends_at > CURRENT_TIMESTAMP) THEN 'TRIALING'
        WHEN t.status = 'TRIAL' THEN 'EXPIRED'
        WHEN t.subscription_ends_at IS NULL OR t.subscription_ends_at > CURRENT_TIMESTAMP THEN 'ACTIVE'
        ELSE 'EXPIRED'
    END,
    'MIGRATION',
    TRUE,
    t.created_at,
    t.created_at,
    CASE WHEN t.status = 'TRIAL' THEN t.trial_ends_at ELSE t.subscription_ends_at END,
    p.price,
    COALESCE(t.currency, 'EGP'),
    CASE WHEN t.max_tables   IS NOT NULL AND t.max_tables   <> p.max_tables   THEN t.max_tables   END,
    CASE WHEN t.max_users    IS NOT NULL AND t.max_users    <> p.max_users    THEN t.max_users    END,
    CASE WHEN t.max_products IS NOT NULL AND t.max_products <> p.max_products THEN t.max_products END,
    'Migrated from the pre-V3 tenant columns'
FROM tenants t
JOIN plans p ON p.code = COALESCE(t.subscription_plan, 'TRIAL')
WHERE t.slug <> 'platform'
  AND NOT EXISTS (SELECT 1 FROM tenant_subscriptions s WHERE s.tenant_id = t.id);

-- Bring the tenant's own status in line with the richer lifecycle it now mirrors.
UPDATE tenants t
SET status = s.status
FROM tenant_subscriptions s
WHERE s.tenant_id = t.id
  AND s.current_subscription
  AND s.status IN ('EXPIRED', 'CANCELLED')
  AND t.status NOT IN ('SUSPENDED');

UPDATE tenants SET status = 'TRIAL'
WHERE id IN (SELECT tenant_id FROM tenant_subscriptions WHERE current_subscription AND status = 'TRIALING')
  AND status <> 'SUSPENDED';

-- ── Retire the columns the subscription now owns ────────────────────────────

ALTER TABLE tenants DROP COLUMN IF EXISTS subscription_plan;
ALTER TABLE tenants DROP COLUMN IF EXISTS trial_ends_at;
ALTER TABLE tenants DROP COLUMN IF EXISTS subscription_ends_at;
ALTER TABLE tenants DROP COLUMN IF EXISTS max_tables;
ALTER TABLE tenants DROP COLUMN IF EXISTS max_users;
ALTER TABLE tenants DROP COLUMN IF EXISTS max_products;
