package com.example.cafemangmentsystem;

import com.example.cafemangmentsystem.tenant.TenantService;
import com.example.cafemangmentsystem.tenant.repository.TenantRepository;
import com.example.cafemangmentsystem.tenant.platform.dto.ProvisionTenantRequest;
import com.example.cafemangmentsystem.tenant.entity.BusinessType;
import com.example.cafemangmentsystem.menu.WanasMenuSeeder;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.jdbc.core.JdbcTemplate;

@Component
public class DatabaseSeeder implements CommandLineRunner {

    private final TenantRepository tenantRepository;
    private final TenantService tenantService;
    private final JdbcTemplate jdbcTemplate;
    private final WanasMenuSeeder wanasMenuSeeder;
    private final org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;

    public DatabaseSeeder(TenantRepository tenantRepository, TenantService tenantService, JdbcTemplate jdbcTemplate, WanasMenuSeeder wanasMenuSeeder, org.springframework.security.crypto.password.PasswordEncoder passwordEncoder) {
        this.tenantRepository = tenantRepository;
        this.tenantService = tenantService;
        this.jdbcTemplate = jdbcTemplate;
        this.wanasMenuSeeder = wanasMenuSeeder;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) throws Exception {
        // Add orders.delivery_fee if missing (added for the takeaway delivery-fee feature).
        // Hibernate's ddl-auto=update generates "ALTER TABLE ... ADD COLUMN delivery_fee ...
        // NOT NULL" with no DEFAULT clause (Lombok's @Builder.Default has no effect on the actual
        // DDL Hibernate emits - it's a builder-only convenience Hibernate doesn't see at all).
        // SQLite refuses to add a NOT NULL column with no default to a non-empty table, so on any
        // database that already had rows in `orders`, that ALTER TABLE silently failed at startup
        // and left the column missing entirely - breaking every subsequent order query. This adds
        // it explicitly with a default, and is a no-op once the column exists.
        try {
            boolean hasDeliveryFee = Boolean.TRUE.equals(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) > 0 FROM pragma_table_info('orders') WHERE name = 'delivery_fee'",
                Boolean.class));
            if (!hasDeliveryFee) {
                jdbcTemplate.execute("ALTER TABLE orders ADD COLUMN delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0");
                System.out.println("[SEEDER] Added missing orders.delivery_fee column.");
            }
        } catch (Exception e) {
            System.err.println("[SEEDER] Failed to add orders.delivery_fee column: " + e.getMessage());
        }

        try {
            boolean hasSnacksNet = Boolean.TRUE.equals(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) > 0 FROM pragma_table_info('shifts') WHERE name = 'snacks_net'",
                Boolean.class));
            if (!hasSnacksNet) {
                jdbcTemplate.execute("ALTER TABLE shifts ADD COLUMN snacks_net NUMERIC(10,2) NOT NULL DEFAULT 0");
                System.out.println("[SEEDER] Added missing shifts.snacks_net column.");
            }
        } catch (Exception e) {
            System.err.println("[SEEDER] Failed to add shifts.snacks_net column: " + e.getMessage());
        }

        // Ensure expenses table columns exist for Petty Cash Advance & Settlement
        String[] expenseCols = {
            "status TEXT DEFAULT 'COMPLETED'",
            "advance_amount NUMERIC(10,2)",
            "actual_amount NUMERIC(10,2)",
            "returned_amount NUMERIC(10,2)",
            "is_advance INTEGER DEFAULT 0",
            "settled_at INTEGER",
            "settled_by INTEGER"
        };
        for (String colDef : expenseCols) {
            String colName = colDef.split(" ")[0];
            try {
                boolean exists = Boolean.TRUE.equals(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) > 0 FROM pragma_table_info('expenses') WHERE name = '" + colName + "'",
                    Boolean.class));
                if (!exists) {
                    jdbcTemplate.execute("ALTER TABLE expenses ADD COLUMN " + colDef);
                    System.out.println("[SEEDER] Added missing expenses." + colName + " column.");
                }
            } catch (Exception e) {
                System.err.println("[SEEDER] Failed to add expenses." + colName + ": " + e.getMessage());
            }
        }

        // Ensure tenants table columns exist for SaaS Subscriptions
        String[] tenantCols = {
            "subscription_plan TEXT DEFAULT 'PRO'",
            "trial_ends_at INTEGER",
            "subscription_ends_at INTEGER",
            "max_tables INTEGER",
            "max_users INTEGER",
            "max_products INTEGER"
        };
        for (String colDef : tenantCols) {
            String colName = colDef.split(" ")[0];
            try {
                boolean exists = Boolean.TRUE.equals(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) > 0 FROM pragma_table_info('tenants') WHERE name = '" + colName + "'",
                    Boolean.class));
                if (!exists) {
                    jdbcTemplate.execute("ALTER TABLE tenants ADD COLUMN " + colDef);
                    System.out.println("[SEEDER] Added missing tenants." + colName + " column.");
                }
            } catch (Exception e) {
                System.err.println("[SEEDER] Failed to add tenants." + colName + ": " + e.getMessage());
            }
        }

        // Seed default Shift Audit Raw Materials if empty
        try {
            int auditItemCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM shift_audit_items", Integer.class);
            if (auditItemCount == 0) {
                Long firstTenantId = jdbcTemplate.queryForObject("SELECT id FROM tenants LIMIT 1", Long.class);
                if (firstTenantId != null) {
                    jdbcTemplate.execute("INSERT INTO shift_audit_items (tenant_id, name, unit, stock_quantity, min_threshold, requires_audit, active, created_at, updated_at) " +
                            "VALUES (" + firstTenantId + ", 'قهوة / بن (جرام)', 'جرام', 1000.0, 100.0, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)");
                    jdbcTemplate.execute("INSERT INTO shift_audit_items (tenant_id, name, unit, stock_quantity, min_threshold, requires_audit, active, created_at, updated_at) " +
                            "VALUES (" + firstTenantId + ", 'حليب / لبن (لتر)', 'لتر', 10.0, 2.0, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)");
                    jdbcTemplate.execute("INSERT INTO shift_audit_items (tenant_id, name, unit, stock_quantity, min_threshold, requires_audit, active, created_at, updated_at) " +
                            "VALUES (" + firstTenantId + ", 'أكواب سفري (قطعة)', 'قطعة', 200.0, 20.0, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)");
                    System.out.println("[SEEDER] Seeded default Shift Audit Items (Coffee, Milk, Cups).");
                }
            }
        } catch (Exception e) {
            System.out.println("[SEEDER] Default audit item seeding skipped: " + e.getMessage());
        }

        // Run database corrections first (BAR products/order items should map to BUFFET revenue line)
        try {
            jdbcTemplate.execute(
                "UPDATE products SET revenue_line = 'BUFFET' " +
                "WHERE station_id IN (SELECT id FROM stations WHERE code = 'BAR') AND revenue_line = 'FOOD'"
            );
            jdbcTemplate.execute(
                "UPDATE order_items SET revenue_line_snapshot = 'BUFFET' " +
                "WHERE station_snapshot = 'BAR' AND revenue_line_snapshot = 'FOOD'"
            );
            System.out.println("[SEEDER] Corrected BAR products/order items to BUFFET revenue line.");
        } catch (Exception e) {
            System.err.println("[SEEDER] Failed to correct revenue lines: " + e.getMessage());
        }

        // Patch the expenses.type CHECK constraint to allow the new DEBTS type (added for debt
        // settlement). SQLite bakes enum CHECK constraints into the table's DDL text at creation
        // time, and Hibernate's ddl-auto=update never rewrites that text for a table that already
        // exists - so on any database created before this change, inserting an expense with
        // type=DEBTS would fail its CHECK constraint. This rewrites the stored CREATE TABLE text in
        // sqlite_master directly (the standard SQLite technique, since ALTER TABLE cannot modify
        // CHECK constraints) and is a no-op once the constraint already allows DEBTS.
        try {
            Boolean needsPatch = jdbcTemplate.queryForObject(
                "SELECT sql NOT LIKE '%DEBTS%' FROM sqlite_master WHERE type='table' AND name='expenses'",
                Boolean.class);
            if (Boolean.TRUE.equals(needsPatch)) {
                jdbcTemplate.execute("PRAGMA writable_schema = 1");
                jdbcTemplate.update(
                    "UPDATE sqlite_master SET sql = REPLACE(sql, ?, ?) WHERE type='table' AND name='expenses'",
                    "'INSTALLMENTS')))", "'INSTALLMENTS','DEBTS')))"
                );
                jdbcTemplate.execute("PRAGMA writable_schema = 0");
                System.out.println("[SEEDER] Patched expenses.type CHECK constraint to allow DEBTS.");
            }
        } catch (Exception e) {
            System.err.println("[SEEDER] Failed to patch expenses type constraint: " + e.getMessage());
            try { jdbcTemplate.execute("PRAGMA writable_schema = 0"); } catch (Exception ignored) { }
        }

        // Ensure paid_amount column exists on debts table
        try {
            jdbcTemplate.execute("ALTER TABLE debts ADD COLUMN paid_amount NUMERIC NOT NULL DEFAULT 0");
            System.out.println("[SEEDER] Added paid_amount column to debts table.");
        } catch (Exception ignored) {
            // Column already exists or table doesn't exist yet
        }

        // Ensure every existing tenant has a register seeded.
        // This previously inserted into a `deleted` column that doesn't exist on `registers`
        // (the real columns are `deleted_at`/`deleted_by`) and omitted the NOT NULL
        // created_at/updated_at/version/active columns, so it has silently failed on every
        // startup since it was written. Never actually blocked real usage because tenant
        // provisioning (TenantOwnerProvisioner) already creates a valid register through JPA -
        // this is only a safety net for tenants that somehow ended up with none.
        try {
            jdbcTemplate.query("SELECT id FROM tenants", (rs, rowNum) -> rs.getLong("id")).forEach(tenantId -> {
                Integer count = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM registers WHERE tenant_id = ?",
                    Integer.class,
                    tenantId
                );
                if (count == null || count == 0) {
                    jdbcTemplate.update(
                        "INSERT INTO registers (tenant_id, name, active, version, created_at, updated_at) " +
                        "VALUES (?, ?, 1, 0, ?, ?)",
                        tenantId,
                        "الدرج الرئيسي",
                        System.currentTimeMillis(),
                        System.currentTimeMillis()
                    );
                    System.out.println("[SEEDER] Seeded 'الدرج الرئيسي' for tenant ID: " + tenantId);
                }
            });
        } catch (Exception e) {
            System.err.println("[SEEDER] Failed to seed registers for existing tenants: " + e.getMessage());
        }

        // Fix unparseable ISO timestamps in cafe_tables if any exist
        try {
            jdbcTemplate.execute("UPDATE cafe_tables SET created_at = datetime('now'), updated_at = datetime('now') WHERE created_at LIKE '%T%' OR created_at IS NULL");
            System.out.println("[SEEDER] Corrected cafe_tables timestamps to SQLite format.");
        } catch (Exception e) {
            System.err.println("[SEEDER] Timestamp cleanup skipped: " + e.getMessage());
        }

        // Ensure 40 tables exist for every tenant
        try {
            jdbcTemplate.query("SELECT id FROM tenants", (rs, rowNum) -> rs.getLong("id")).forEach(tenantId -> {
                Integer tableCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM cafe_tables WHERE tenant_id = ?",
                    Integer.class,
                    tenantId
                );
                if (tableCount == null || tableCount < 40) {
                    for (int i = 1; i <= 40; i++) {
                        Integer exists = jdbcTemplate.queryForObject(
                            "SELECT COUNT(*) FROM cafe_tables WHERE tenant_id = ? AND number = ?",
                            Integer.class,
                            tenantId,
                            i
                        );
                        if (exists == null || exists == 0) {
                            String zone = "INDOOR";
                            int seats = 4;
                            if (i > 20 && i <= 32) {
                                zone = "OUTDOOR";
                                seats = 4;
                            } else if (i > 32) {
                                zone = "UPSTAIRS";
                                seats = 6;
                            }
                            jdbcTemplate.update(
                                "INSERT INTO cafe_tables (tenant_id, number, zone, seats, active, version, created_at, updated_at) VALUES (?, ?, ?, ?, 1, 0, datetime('now'), datetime('now'))",
                                tenantId,
                                i,
                                zone,
                                seats
                            );
                        }
                    }
                    System.out.println("[SEEDER] Seeded 40 tables for tenant ID: " + tenantId);
                }
            });
        } catch (Exception e) {
            System.err.println("[SEEDER] Failed to seed 40 tables: " + e.getMessage());
        }

        // Shifts MUST ONLY be closed manually by the cashier.
        // Never automatically force-close active shifts on application startup or restart.

        if (tenantRepository.count() == 0) {
            System.out.println("[SEEDER] Database is empty. Seeding default tenants...");
            
            // 1. Seed tenant caffio
            try {
                ProvisionTenantRequest req1 = new ProvisionTenantRequest(
                    "كافيو - Caffio",
                    "caffio",
                    BusinessType.CAFE_AND_RESTAURANT,
                    "admin",
                    "password123",
                    "Admin User",
                    "Africa/Cairo",
                    "EGP",
                    null,
                    null
                );
                tenantService.provisionWithSetup(req1);
                System.out.println("[SEEDER] Default tenant 'caffio' seeded successfully!");
            } catch (Exception e) {
                System.err.println("[SEEDER] Failed to seed 'caffio': " + e.getMessage());
            }

            // 2. Seed secondary demo tenant
            try {
                ProvisionTenantRequest req2 = new ProvisionTenantRequest(
                    "كافيو فرع 2",
                    "caffio-demo",
                    BusinessType.CAFE,
                    "jeox",
                    "12345678",
                    "Jeo X",
                    "Africa/Cairo",
                    "EGP",
                    null,
                    null
                );
                tenantService.provisionWithSetup(req2);
                System.out.println("[SEEDER] Tenant 'caffio-demo' seeded successfully!");
            } catch (Exception e) {
                System.err.println("[SEEDER] Failed to seed 'caffio-demo': " + e.getMessage());
            }
        }

        // Ensure tenant 'caffio' exists
        if (tenantRepository.findBySlug("caffio").isEmpty()) {
            try {
                ProvisionTenantRequest req = new ProvisionTenantRequest(
                    "كافيو - Caffio",
                    "caffio",
                    BusinessType.CAFE_AND_RESTAURANT,
                    "admin",
                    "12345678",
                    "Caffio Owner",
                    "Africa/Cairo",
                    "EGP",
                    null,
                    null
                );
                tenantService.provisionWithSetup(req);
                System.out.println("[SEEDER] Tenant 'caffio' provisioned successfully!");
            } catch (Exception e) {
                System.err.println("[SEEDER] Failed to provision 'caffio': " + e.getMessage());
            }
        }

        // Ensure tenant 'caffio' has dedicated superadmin account
        try {
            Long caffioId = jdbcTemplate.queryForObject(
                "SELECT id FROM tenants WHERE slug = 'caffio'", Long.class);
            if (caffioId != null) {
                Integer count = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM users WHERE tenant_id = ? AND username = 'superadmin'",
                    Integer.class, caffioId);
                if (count == null || count == 0) {
                    String pwdHash = passwordEncoder.encode("admin123");
                    jdbcTemplate.update(
                        "INSERT INTO users (tenant_id, username, password_hash, full_name, role, active, version, created_at, updated_at) " +
                        "VALUES (?, 'superadmin', ?, 'Super Admin 👑', 'ADMIN', 1, 0, datetime('now'), datetime('now'))",
                        caffioId, pwdHash
                    );
                    System.out.println("[SEEDER] Created dedicated 'superadmin' account for tenant 'caffio' (password: admin123)");
                }
            }
        } catch (Exception e) {
            System.err.println("[SEEDER] Could not seed superadmin account: " + e.getMessage());
        }

        // Ensure all existing tenants have subscription_plan populated
        try {
            jdbcTemplate.execute("UPDATE tenants SET subscription_plan = 'PRO' WHERE subscription_plan IS NULL");
        } catch (Exception e) {}

        // Seed/Upgrade Wanas Cafe menu for all tenants
        try {
            wanasMenuSeeder.seedMenuForAllTenants();
        } catch (Exception e) {
            System.err.println("[SEEDER] Failed to seed Wanas Cafe menu: " + e.getMessage());
        }
    }
}
