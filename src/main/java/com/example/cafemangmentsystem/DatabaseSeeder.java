package com.example.cafemangmentsystem;

import com.example.cafemangmentsystem.tenant.TenantService;
import com.example.cafemangmentsystem.tenant.repository.TenantRepository;
import com.example.cafemangmentsystem.tenant.platform.dto.ProvisionTenantRequest;
import com.example.cafemangmentsystem.tenant.entity.BusinessType;
import com.example.cafemangmentsystem.menu.WanasMenuSeeder;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.List;

@Component
public class DatabaseSeeder implements CommandLineRunner {

    private final TenantRepository tenantRepository;
    private final TenantService tenantService;
    private final JdbcTemplate jdbcTemplate;
    private final WanasMenuSeeder wanasMenuSeeder;
    private final org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;
    private final com.example.cafemangmentsystem.debt.repository.DebtRepository debtRepository;
    private final com.example.cafemangmentsystem.user.repository.UserRepository userRepository;

    public DatabaseSeeder(TenantRepository tenantRepository, TenantService tenantService, JdbcTemplate jdbcTemplate, WanasMenuSeeder wanasMenuSeeder, org.springframework.security.crypto.password.PasswordEncoder passwordEncoder, com.example.cafemangmentsystem.debt.repository.DebtRepository debtRepository, com.example.cafemangmentsystem.user.repository.UserRepository userRepository) {
        this.tenantRepository = tenantRepository;
        this.tenantService = tenantService;
        this.jdbcTemplate = jdbcTemplate;
        this.wanasMenuSeeder = wanasMenuSeeder;
        this.passwordEncoder = passwordEncoder;
        this.debtRepository = debtRepository;
        this.userRepository = userRepository;
    }

    @Override
    public void run(String... args) throws Exception {
        boolean isSqlite = false;
        try {
            String dbProductName = jdbcTemplate.getDataSource().getConnection().getMetaData().getDatabaseProductName();
            isSqlite = dbProductName != null && dbProductName.toLowerCase().contains("sqlite");
        } catch (Exception ignored) {}

        if (isSqlite) {
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
        }

        // Shift audit raw materials (audit_items) are intentionally never seeded: they are
        // business-specific (a bakery's ingredients look nothing like a coffee shop's), and the
        // Inventory page already has a full add/edit/delete UI for them. A prior version of this
        // seeder hardcoded 3 fixed items (coffee, milk, cups) via `SELECT id FROM tenants LIMIT 1`
        // gated by a global `COUNT(*) == 0` check - so it only ever ran once, for whichever tenant
        // happened to be first, and every tenant created afterward silently got none at all.

        // Seed default Cash Register if empty
        try {
            int regCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM registers", Integer.class);
            if (regCount == 0) {
                Long firstTenantId = jdbcTemplate.queryForObject("SELECT id FROM tenants LIMIT 1", Long.class);
                if (firstTenantId != null) {
                    jdbcTemplate.execute("INSERT INTO registers (tenant_id, name, active, created_at, updated_at) " +
                            "VALUES (" + firstTenantId + ", 'الكاشير الرئيسي (الدرج 1)', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)");
                    System.out.println("[SEEDER] Seeded default Cash Register.");
                }
            }
        } catch (Exception e) {
            System.out.println("[SEEDER] Default register seeding skipped: " + e.getMessage());
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

        // Fix missing columns in SQLite
        try {
            jdbcTemplate.execute("ALTER TABLE products ADD COLUMN reserved_quantity INTEGER DEFAULT 0");
        } catch (Exception ignored) {}
        try {
            jdbcTemplate.execute("ALTER TABLE products ADD COLUMN min_stock_threshold INTEGER DEFAULT 10");
        } catch (Exception ignored) {}
        try {
            jdbcTemplate.execute("ALTER TABLE products ADD COLUMN track_inventory BOOLEAN DEFAULT 0");
        } catch (Exception ignored) {}
        try {
            jdbcTemplate.execute("DELETE FROM debts");
        } catch (Exception ignored) {}
        try {
            jdbcTemplate.execute("UPDATE products SET available = 1 WHERE active = 1");
        } catch (Exception ignored) {}

        // Fix unparseable ISO timestamps in cafe_tables if any exist
        try {
            jdbcTemplate.execute("UPDATE cafe_tables SET created_at = datetime('now'), updated_at = datetime('now') WHERE created_at LIKE '%T%' OR created_at IS NULL");
            System.out.println("[SEEDER] Corrected cafe_tables timestamps to SQLite format.");
        } catch (Exception e) {
            System.err.println("[SEEDER] Timestamp cleanup skipped: " + e.getMessage());
        }

        // Ensure Platform Master Tenant and Super Admin exist
        try {
            Tenant platformTenant = tenantRepository.findBySlug("platform").orElse(null);
            if (platformTenant == null) {
                platformTenant = Tenant.builder()
                        .name("Caffio Platform")
                        .slug("platform")
                        .businessType(BusinessType.CAFE_AND_RESTAURANT)
                        .status(com.example.cafemangmentsystem.tenant.entity.TenantStatus.ACTIVE)
                        .timezone("Africa/Cairo")
                        .currency("EGP")
                        .subscriptionPlan(com.example.cafemangmentsystem.tenant.entity.SubscriptionPlan.ENTERPRISE)
                        .maxTables(9999)
                        .maxUsers(9999)
                        .maxProducts(9999)
                        .planSelected(true)
                        .build();
                platformTenant = tenantRepository.save(platformTenant);
                System.out.println("[SEEDER] Created Master Platform Tenant (ID: " + platformTenant.getId() + ")");
            }

            if (platformTenant != null) {
                TenantContext.set(platformTenant.getId());
                try {
                    User adminUser = userRepository.findByUsername("alaaHarb").orElse(null);
                    if (adminUser == null) {
                        adminUser = User.builder()
                                .tenantId(platformTenant.getId())
                                .username("alaaHarb")
                                .passwordHash(passwordEncoder.encode("alaa@12345"))
                                .fullName("Alaa Harb")
                                .role(Role.ADMIN)
                                .active(true)
                                .build();
                        userRepository.save(adminUser);
                        System.out.println("[SEEDER] Super Admin 'alaaHarb' initialized successfully.");
                    }
                } finally {
                    TenantContext.clear();
                }
            }
        } catch (Exception e) {
            System.err.println("[SEEDER] Platform bootstrap check: " + e.getMessage());
        }

        // Ensure default Wanas Cafe tenant exists
        try {
            Tenant wanasTenant = tenantRepository.findBySlug("wanas").orElse(null);
            if (wanasTenant == null) {
                wanasTenant = Tenant.builder()
                        .name("Wanas Cafe")
                        .slug("wanas")
                        .businessType(BusinessType.CAFE)
                        .status(com.example.cafemangmentsystem.tenant.entity.TenantStatus.ACTIVE)
                        .timezone("Africa/Cairo")
                        .currency("EGP")
                        .subscriptionPlan(com.example.cafemangmentsystem.tenant.entity.SubscriptionPlan.PRO)
                        .maxTables(50)
                        .maxUsers(10)
                        .maxProducts(200)
                        .planSelected(true)
                        .build();
                wanasTenant = tenantRepository.save(wanasTenant);
                System.out.println("[SEEDER] Created Wanas Cafe Tenant (ID: " + wanasTenant.getId() + ")");
            }

            if (wanasTenant != null) {
                TenantContext.set(wanasTenant.getId());
                try {
                    User wanasAdmin = userRepository.findByUsername("alaaHarb").orElse(null);
                    if (wanasAdmin == null) {
                        wanasAdmin = User.builder()
                                .tenantId(wanasTenant.getId())
                                .username("alaaHarb")
                                .passwordHash(passwordEncoder.encode("alaa@12345"))
                                .fullName("Alaa Harb")
                                .role(Role.ADMIN)
                                .active(true)
                                .build();
                        userRepository.save(wanasAdmin);
                    }
                    User cashier = userRepository.findByUsername("cashier1").orElse(null);
                    if (cashier == null) {
                        cashier = User.builder()
                                .tenantId(wanasTenant.getId())
                                .username("cashier1")
                                .passwordHash(passwordEncoder.encode("123456"))
                                .fullName("كاشير 1")
                                .role(Role.CASHIER)
                                .active(true)
                                .build();
                        userRepository.save(cashier);
                    }
                } finally {
                    TenantContext.clear();
                }
            }
        } catch (Exception e) {
            System.err.println("[SEEDER] Wanas bootstrap check: " + e.getMessage());
        }
    }
}
