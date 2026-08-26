-- Flyway V1 Initial PostgreSQL SaaS Database Schema for Caffio POS Platform
--
-- Rewritten from scratch to exactly match the current JPA entity model (com.example.cafemangmentsystem.**.entity.*).
-- Every entity extends one of:
--   BaseEntity           -> id BIGSERIAL PK, created_at/updated_at TIMESTAMPTZ NOT NULL, created_by/updated_by BIGINT, version BIGINT NOT NULL DEFAULT 0
--   TenantScopedEntity    -> BaseEntity + tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
--   SoftDeletableEntity   -> TenantScopedEntity + active BOOLEAN NOT NULL DEFAULT TRUE, deleted_at TIMESTAMPTZ, deleted_by BIGINT
-- Tables are created in FK-dependency order. created_by/updated_by/deleted_by are plain BIGINT
-- (no FK) matching the entities, which don't map them as relations.

-- Entity: com.example.cafemangmentsystem.tenant.entity.Tenant (extends BaseEntity - the tenant root, not itself tenant-scoped)
CREATE TABLE IF NOT EXISTS tenants (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    version BIGINT NOT NULL DEFAULT 0,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    business_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    timezone VARCHAR(255) NOT NULL,
    currency VARCHAR(255) NOT NULL,
    subscription_plan VARCHAR(50) NOT NULL DEFAULT 'TRIAL',
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    subscription_ends_at TIMESTAMP WITH TIME ZONE,
    max_tables INT,
    max_users INT,
    max_products INT,
    service_charge_percent INT,
    owner_whatsapp VARCHAR(255),
    whatsapp_alerts_enabled BOOLEAN DEFAULT FALSE
);

-- Entity: com.example.cafemangmentsystem.user.entity.User (extends SoftDeletableEntity)
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    version BIGINT NOT NULL DEFAULT 0,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by BIGINT,
    username VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    pin_hash VARCHAR(255),
    role VARCHAR(50) NOT NULL,
    CONSTRAINT uk_users_tenant_username UNIQUE (tenant_id, username)
);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);

-- Entity: com.example.cafemangmentsystem.menu.entity.Category (extends SoftDeletableEntity)
CREATE TABLE IF NOT EXISTS categories (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    version BIGINT NOT NULL DEFAULT 0,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by BIGINT,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    display_order INT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_categories_tenant ON categories(tenant_id);

-- Entity: com.example.cafemangmentsystem.printing.entity.Printer (extends TenantScopedEntity)
CREATE TABLE IF NOT EXISTS printers (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    version BIGINT NOT NULL DEFAULT 0,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    ip_address VARCHAR(255) NOT NULL,
    port INT NOT NULL,
    type VARCHAR(50) NOT NULL,
    paper_width INT NOT NULL,
    is_online BOOLEAN NOT NULL DEFAULT FALSE,
    last_seen_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_printers_tenant ON printers(tenant_id);

-- Entity: com.example.cafemangmentsystem.station.entity.Station (extends TenantScopedEntity)
CREATE TABLE IF NOT EXISTS stations (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    version BIGINT NOT NULL DEFAULT 0,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name_ar VARCHAR(255) NOT NULL,
    printer_id BIGINT REFERENCES printers(id) ON DELETE SET NULL,
    CONSTRAINT uk_stations_tenant_code UNIQUE (tenant_id, code)
);
CREATE INDEX IF NOT EXISTS idx_stations_tenant ON stations(tenant_id);

-- Entity: com.example.cafemangmentsystem.menu.entity.Product (extends SoftDeletableEntity)
CREATE TABLE IF NOT EXISTS products (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    version BIGINT NOT NULL DEFAULT 0,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by BIGINT,
    category_id BIGINT NOT NULL REFERENCES categories(id),
    station_id BIGINT NOT NULL REFERENCES stations(id),
    revenue_line VARCHAR(50) NOT NULL,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    price NUMERIC(10, 2) NOT NULL,
    available BOOLEAN NOT NULL DEFAULT TRUE,
    prep_note VARCHAR(255),
    stock_quantity INT NOT NULL DEFAULT 0,
    -- Soft reservation counter: quantity held by NEW (not yet sent) order items. See
    -- OrderService.reserveStock/releaseReservation. Folded in here (previously V2 migration).
    reserved_quantity INT NOT NULL DEFAULT 0,
    track_inventory BOOLEAN NOT NULL DEFAULT FALSE,
    min_stock_threshold INT
);
CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_station ON products(station_id);

-- Entity: com.example.cafemangmentsystem.menu.entity.ProductOption (extends TenantScopedEntity)
CREATE TABLE IF NOT EXISTS product_options (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    version BIGINT NOT NULL DEFAULT 0,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name_ar VARCHAR(255) NOT NULL,
    price_delta NUMERIC(10, 2) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_product_options_tenant ON product_options(tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_options_product ON product_options(product_id);

-- Entity: com.example.cafemangmentsystem.cafetable.entity.CafeTable (extends SoftDeletableEntity)
CREATE TABLE IF NOT EXISTS cafe_tables (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    version BIGINT NOT NULL DEFAULT 0,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by BIGINT,
    number INT NOT NULL,
    zone VARCHAR(50) NOT NULL,
    seats INT NOT NULL,
    CONSTRAINT uk_tables_tenant_number UNIQUE (tenant_id, number)
);
CREATE INDEX IF NOT EXISTS idx_cafe_tables_tenant ON cafe_tables(tenant_id);

-- Entity: com.example.cafemangmentsystem.register.entity.Register (extends SoftDeletableEntity)
CREATE TABLE IF NOT EXISTS registers (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    version BIGINT NOT NULL DEFAULT 0,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by BIGINT,
    name VARCHAR(255) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_registers_tenant ON registers(tenant_id);

-- Entity: com.example.cafemangmentsystem.shift.entity.Shift (extends TenantScopedEntity)
CREATE TABLE IF NOT EXISTS shifts (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    version BIGINT NOT NULL DEFAULT 0,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id),
    register_id BIGINT NOT NULL REFERENCES registers(id),
    opened_at TIMESTAMP WITH TIME ZONE NOT NULL,
    closed_at TIMESTAMP WITH TIME ZONE,
    opening_float NUMERIC(10, 2) NOT NULL,
    expected_cash NUMERIC(10, 2),
    counted_cash NUMERIC(10, 2),
    variance NUMERIC(10, 2),
    snacks_net NUMERIC(10, 2) DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_shifts_tenant ON shifts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shifts_user ON shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_shifts_register ON shifts(register_id);

-- Entity: com.example.cafemangmentsystem.order.entity.Order (extends TenantScopedEntity)
CREATE TABLE IF NOT EXISTS orders (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    version BIGINT NOT NULL DEFAULT 0,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_number INT NOT NULL,
    table_id BIGINT REFERENCES cafe_tables(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    opened_by BIGINT NOT NULL REFERENCES users(id),
    closed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    served_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    shift_id BIGINT NOT NULL REFERENCES shifts(id),
    subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0,
    discount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    service NUMERIC(10, 2) NOT NULL DEFAULT 0,
    delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total NUMERIC(10, 2) NOT NULL DEFAULT 0,
    guest_count INT,
    customer_name VARCHAR(255),
    customer_phone VARCHAR(255),
    customer_address VARCHAR(255),
    pickup_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE NOT NULL,
    closed_at TIMESTAMP WITH TIME ZONE,
    served_at TIMESTAMP WITH TIME ZONE,
    void_reason VARCHAR(255)
);
CREATE INDEX IF NOT EXISTS idx_orders_tenant ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_shift ON orders(shift_id);
CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_id);

-- Entity: com.example.cafemangmentsystem.order.entity.OrderItem (extends TenantScopedEntity)
CREATE TABLE IF NOT EXISTS order_items (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    version BIGINT NOT NULL DEFAULT 0,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id),
    product_name_snapshot VARCHAR(255) NOT NULL,
    category_name_snapshot VARCHAR(255),
    unit_price_snapshot NUMERIC(10, 2) NOT NULL,
    station_snapshot VARCHAR(50) NOT NULL,
    revenue_line_snapshot VARCHAR(50) NOT NULL,
    quantity INT NOT NULL,
    discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL,
    note VARCHAR(255),
    added_by BIGINT NOT NULL REFERENCES users(id),
    cancelled_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    cancel_reason VARCHAR(255)
);
CREATE INDEX IF NOT EXISTS idx_order_items_tenant ON order_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

-- Entity: com.example.cafemangmentsystem.payment.entity.Payment (extends TenantScopedEntity)
CREATE TABLE IF NOT EXISTS payments (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    version BIGINT NOT NULL DEFAULT 0,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    method VARCHAR(50) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    received NUMERIC(10, 2),
    change_amount NUMERIC(10, 2),
    reference VARCHAR(255),
    paid_at TIMESTAMP WITH TIME ZONE NOT NULL,
    cashier_id BIGINT NOT NULL REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);

-- Entity: com.example.cafemangmentsystem.discount.entity.Discount (extends TenantScopedEntity)
CREATE TABLE IF NOT EXISTS discounts (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    version BIGINT NOT NULL DEFAULT 0,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    order_item_id BIGINT REFERENCES order_items(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    scope VARCHAR(50) NOT NULL,
    value NUMERIC(10, 2) NOT NULL,
    max_value NUMERIC(10, 2),
    requires_supervisor BOOLEAN NOT NULL DEFAULT TRUE,
    reason VARCHAR(255) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    applied_by BIGINT NOT NULL REFERENCES users(id),
    applied_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_discounts_tenant ON discounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_discounts_order ON discounts(order_id);
CREATE INDEX IF NOT EXISTS idx_discounts_order_item ON discounts(order_item_id);

-- Entity: com.example.cafemangmentsystem.employee.entity.Employee (extends TenantScopedEntity)
-- full_name/name, position/job_title, base_salary/daily_wage are intentionally duplicated columns
-- (the entity mirrors each pair via getter/setter overrides for backward/forward compatibility).
CREATE TABLE IF NOT EXISTS employees (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    version BIGINT NOT NULL DEFAULT 0,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    full_name VARCHAR(255),
    name VARCHAR(255),
    position VARCHAR(255),
    job_title VARCHAR(255),
    base_salary NUMERIC(10, 2),
    daily_wage NUMERIC(10, 2),
    phone VARCHAR(255),
    hire_date DATE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    salary_period VARCHAR(255) DEFAULT 'WEEKLY'
);
CREATE INDEX IF NOT EXISTS idx_employees_tenant ON employees(tenant_id);

-- Entity: com.example.cafemangmentsystem.employee.entity.EmployeeTransaction (extends TenantScopedEntity)
CREATE TABLE IF NOT EXISTS employee_transactions (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    version BIGINT NOT NULL DEFAULT 0,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    notes VARCHAR(255),
    transaction_date DATE NOT NULL,
    settled BOOLEAN NOT NULL DEFAULT FALSE,
    paid_from_drawer BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_employee_transactions_tenant ON employee_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employee_transactions_employee ON employee_transactions(employee_id);

-- Entity: com.example.cafemangmentsystem.expense.entity.Expense (extends TenantScopedEntity)
CREATE TABLE IF NOT EXISTS expenses (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    version BIGINT NOT NULL DEFAULT 0,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    revenue_line VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',
    amount NUMERIC(10, 2) NOT NULL,
    advance_amount NUMERIC(10, 2),
    actual_amount NUMERIC(10, 2),
    returned_amount NUMERIC(10, 2),
    is_advance BOOLEAN NOT NULL DEFAULT FALSE,
    settled_at TIMESTAMP WITH TIME ZONE,
    settled_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    expense_date DATE NOT NULL,
    is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
    paid_from_drawer BOOLEAN NOT NULL DEFAULT FALSE,
    shift_id BIGINT REFERENCES shifts(id) ON DELETE SET NULL,
    employee_id BIGINT REFERENCES employees(id) ON DELETE SET NULL,
    recorded_by BIGINT NOT NULL REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_expenses_tenant ON expenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_expenses_shift ON expenses(shift_id);

-- Entity: com.example.cafemangmentsystem.debt.entity.Debt (extends TenantScopedEntity)
CREATE TABLE IF NOT EXISTS debts (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    version BIGINT NOT NULL DEFAULT 0,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    creditor_name VARCHAR(255) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    paid_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    debt_date DATE NOT NULL,
    due_date DATE,
    settled BOOLEAN NOT NULL DEFAULT FALSE,
    settled_at TIMESTAMP WITH TIME ZONE,
    paid_from_drawer BOOLEAN NOT NULL DEFAULT FALSE,
    recorded_by BIGINT NOT NULL REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_debts_tenant ON debts(tenant_id);

-- Entity: com.example.cafemangmentsystem.inventory.entity.StockAdjustment (extends TenantScopedEntity)
-- Manual stock changes only (restock/waste/correction) - sale/cancel deductions happen inline on
-- Product via OrderService and aren't logged here (Order/OrderItem already audit those).
CREATE TABLE IF NOT EXISTS stock_adjustments (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    version BIGINT NOT NULL DEFAULT 0,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id),
    type VARCHAR(50) NOT NULL,
    quantity_change INT NOT NULL,
    resulting_quantity INT NOT NULL,
    reason VARCHAR(255) NOT NULL,
    adjusted_by BIGINT NOT NULL REFERENCES users(id),
    adjusted_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_tenant ON stock_adjustments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_product ON stock_adjustments(product_id);

-- Entity: com.example.cafemangmentsystem.printing.entity.PrintJob (extends TenantScopedEntity)
CREATE TABLE IF NOT EXISTS print_jobs (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    version BIGINT NOT NULL DEFAULT 0,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    printer_id BIGINT NOT NULL REFERENCES printers(id),
    ticket_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    payload TEXT NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    last_error VARCHAR(255),
    idempotency_key VARCHAR(255) NOT NULL,
    printed_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uk_print_jobs_tenant_idempotency UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_print_jobs_tenant ON print_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_order ON print_jobs(order_id);

-- Entity: com.example.cafemangmentsystem.security.refresh.entity.RefreshToken (extends BaseEntity - not tenant-scoped)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    version BIGINT NOT NULL DEFAULT 0,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    revoked_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

-- Entity: com.example.cafemangmentsystem.inventory.entity.ShiftAuditItem (extends TenantScopedEntity)
-- Deliberately never seeded with defaults - raw materials are business-specific; every tenant
-- builds its own list via the Inventory page.
CREATE TABLE IF NOT EXISTS shift_audit_items (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    version BIGINT NOT NULL DEFAULT 0,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    unit VARCHAR(255) NOT NULL,
    stock_quantity DOUBLE PRECISION NOT NULL DEFAULT 0,
    min_threshold DOUBLE PRECISION DEFAULT 0,
    requires_audit BOOLEAN NOT NULL DEFAULT TRUE,
    active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_shift_audit_items_tenant ON shift_audit_items(tenant_id);

-- Entity: com.example.cafemangmentsystem.inventory.entity.ProductRecipe (extends TenantScopedEntity)
CREATE TABLE IF NOT EXISTS product_recipes (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    version BIGINT NOT NULL DEFAULT 0,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    audit_item_id BIGINT NOT NULL REFERENCES shift_audit_items(id) ON DELETE CASCADE,
    deduction_quantity DOUBLE PRECISION NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_product_recipes_tenant ON product_recipes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_recipes_product ON product_recipes(product_id);

-- Entity: com.example.cafemangmentsystem.inventory.entity.ShiftAuditRecord (extends TenantScopedEntity)
CREATE TABLE IF NOT EXISTS shift_audit_records (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    version BIGINT NOT NULL DEFAULT 0,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    shift_id BIGINT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
    audit_item_id BIGINT NOT NULL REFERENCES shift_audit_items(id) ON DELETE CASCADE,
    opening_count DOUBLE PRECISION NOT NULL,
    sold_deduction_count DOUBLE PRECISION NOT NULL DEFAULT 0,
    expected_closing_count DOUBLE PRECISION,
    actual_closing_count DOUBLE PRECISION,
    variance_count DOUBLE PRECISION,
    waste_percentage DOUBLE PRECISION,
    audited_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_shift_audit_records_tenant ON shift_audit_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shift_audit_records_shift ON shift_audit_records(shift_id);

-- Entity: com.example.cafemangmentsystem.tenant.entity.TenantActivityLog (extends BaseEntity -
-- tenant_id is a plain column here, not @TenantId, so it isn't Hibernate-filtered like the
-- tenant-scoped tables above; the FK below is for data integrity only).
CREATE TABLE IF NOT EXISTS tenant_activity_logs (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT,
    version BIGINT NOT NULL DEFAULT 0,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    action VARCHAR(255) NOT NULL,
    details TEXT,
    performed_by VARCHAR(255)
);
CREATE INDEX IF NOT EXISTS idx_tenant_activity_logs_tenant ON tenant_activity_logs(tenant_id);
