package com.example.cafemangmentsystem;

import com.example.cafemangmentsystem.common.tenant.TenantContext;
import com.example.cafemangmentsystem.tenant.TenantService;
import com.example.cafemangmentsystem.tenant.entity.Tenant;
import com.example.cafemangmentsystem.tenant.entity.BusinessType;
import com.example.cafemangmentsystem.tenant.repository.TenantRepository;
import com.example.cafemangmentsystem.tenant.platform.dto.ProvisionTenantRequest;
import com.example.cafemangmentsystem.user.entity.User;
import com.example.cafemangmentsystem.user.entity.Role;
import com.example.cafemangmentsystem.menu.WanasMenuSeeder;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.List;

@Component
@ConditionalOnProperty(name = "app.legacy-bootstrap.enabled", havingValue = "true")
public class DatabaseSeeder implements CommandLineRunner {

    private final TenantRepository tenantRepository;
    private final TenantService tenantService;
    private final JdbcTemplate jdbcTemplate;
    private final WanasMenuSeeder wanasMenuSeeder;

    private final org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;
    private final com.example.cafemangmentsystem.debt.repository.DebtRepository debtRepository;
    private final com.example.cafemangmentsystem.user.repository.UserRepository userRepository;
    private final com.example.cafemangmentsystem.inventory.ShiftAuditService shiftAuditService;

    public DatabaseSeeder(TenantRepository tenantRepository, TenantService tenantService, JdbcTemplate jdbcTemplate, WanasMenuSeeder wanasMenuSeeder, org.springframework.security.crypto.password.PasswordEncoder passwordEncoder, com.example.cafemangmentsystem.debt.repository.DebtRepository debtRepository, com.example.cafemangmentsystem.user.repository.UserRepository userRepository, com.example.cafemangmentsystem.inventory.ShiftAuditService shiftAuditService) {
        this.tenantRepository = tenantRepository;
        this.tenantService = tenantService;
        this.jdbcTemplate = jdbcTemplate;
        this.wanasMenuSeeder = wanasMenuSeeder;
        this.passwordEncoder = passwordEncoder;
        this.debtRepository = debtRepository;
        this.userRepository = userRepository;
        this.shiftAuditService = shiftAuditService;
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

        // Patch users.role CHECK constraint to allow SUPER_ADMIN
        try {
            Boolean needsUserRolePatch = jdbcTemplate.queryForObject(
                "SELECT sql NOT LIKE '%SUPER_ADMIN%' FROM sqlite_master WHERE type='table' AND name='users'",
                Boolean.class);
            if (Boolean.TRUE.equals(needsUserRolePatch)) {
                jdbcTemplate.execute("PRAGMA writable_schema = 1");
                jdbcTemplate.update(
                    "UPDATE sqlite_master SET sql = REPLACE(sql, ?, ?) WHERE type='table' AND name='users'",
                    "'ADMIN')", "'ADMIN','SUPER_ADMIN')"
                );
                jdbcTemplate.update(
                    "UPDATE sqlite_master SET sql = REPLACE(sql, ?, ?) WHERE type='table' AND name='users'",
                    "'ADMIN']", "'ADMIN','SUPER_ADMIN']"
                );
                jdbcTemplate.execute("PRAGMA writable_schema = 0");
                System.out.println("[SEEDER] Patched users.role CHECK constraint to allow SUPER_ADMIN.");
            }
        } catch (Exception e) {
            System.err.println("[SEEDER] Failed to patch users role constraint: " + e.getMessage());
            try { jdbcTemplate.execute("PRAGMA writable_schema = 0"); } catch (Exception ignored) { }
        }

        // Ensure paid_amount column exists on debts table
        try {
            jdbcTemplate.execute("ALTER TABLE debts ADD COLUMN paid_amount NUMERIC NOT NULL DEFAULT 0");
            System.out.println("[SEEDER] Added paid_amount column to debts table.");
        } catch (Exception ignored) {
            // Column already exists or table doesn't exist yet
        }

        // Ensure cost_per_unit column exists on shift_audit_items table
        try {
            jdbcTemplate.execute("ALTER TABLE shift_audit_items ADD COLUMN cost_per_unit NUMERIC DEFAULT 0.40");
            System.out.println("[SEEDER] Added cost_per_unit column to shift_audit_items table.");
        } catch (Exception ignored) {
            // Column already exists
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
                platformTenant = new Tenant();
                platformTenant.setName("Caffio Platform");
                platformTenant.setSlug("platform");
                platformTenant.setBusinessType(BusinessType.CAFE_AND_RESTAURANT);
                platformTenant.setStatus(com.example.cafemangmentsystem.tenant.entity.TenantStatus.ACTIVE);
                platformTenant.setTimezone("Africa/Cairo");
                platformTenant.setCurrency("EGP");
                platformTenant.setSubscriptionPlan(com.example.cafemangmentsystem.tenant.entity.SubscriptionPlan.ENTERPRISE);
                platformTenant.setMaxTables(9999);
                platformTenant.setMaxUsers(9999);
                platformTenant.setMaxProducts(9999);
                platformTenant.setPlanSelected(true);
                platformTenant = tenantRepository.save(platformTenant);
                System.out.println("[SEEDER] Created Master Platform Tenant (ID: " + platformTenant.getId() + ")");
            }

            if (platformTenant != null) {
                TenantContext.set(platformTenant.getId());
                try {
                    User adminUser = userRepository.findByTenantIdAndUsername(platformTenant.getId(), "alaaHarb").orElse(null);
                    if (adminUser == null) {
                        adminUser = new User();
                        adminUser.setUsername("alaaHarb");
                        adminUser.setPasswordHash(passwordEncoder.encode("alaa@12345"));
                        adminUser.setFullName("Alaa Harb");
                        adminUser.setRole(Role.SUPER_ADMIN);
                        userRepository.save(adminUser);
                        System.out.println("[SEEDER] Super Admin 'alaaHarb' initialized successfully.");
                    } else if (adminUser.getRole() != Role.SUPER_ADMIN) {
                        adminUser.setRole(Role.SUPER_ADMIN);
                        userRepository.save(adminUser);
                        System.out.println("[SEEDER] Existing platform admin promoted to SUPER_ADMIN.");
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
                wanasTenant = new Tenant();
                wanasTenant.setName("Wanas Cafe");
                wanasTenant.setSlug("wanas");
                wanasTenant.setBusinessType(BusinessType.CAFE);
                wanasTenant.setStatus(com.example.cafemangmentsystem.tenant.entity.TenantStatus.ACTIVE);
                wanasTenant.setTimezone("Africa/Cairo");
                wanasTenant.setCurrency("EGP");
                wanasTenant.setSubscriptionPlan(com.example.cafemangmentsystem.tenant.entity.SubscriptionPlan.PRO);
                wanasTenant.setMaxTables(50);
                wanasTenant.setMaxUsers(10);
                wanasTenant.setMaxProducts(200);
                wanasTenant.setPlanSelected(true);
                wanasTenant = tenantRepository.save(wanasTenant);
                System.out.println("[SEEDER] Created Wanas Cafe Tenant (ID: " + wanasTenant.getId() + ")");
            }

            if (wanasTenant != null) {
                TenantContext.set(wanasTenant.getId());
                try {
                    User wanasAdmin = userRepository.findByTenantIdAndUsername(wanasTenant.getId(), "alaaHarb").orElse(null);
                    if (wanasAdmin == null) {
                        wanasAdmin = new User();
                        wanasAdmin.setUsername("alaaHarb");
                        wanasAdmin.setPasswordHash(passwordEncoder.encode("alaa@12345"));
                        wanasAdmin.setPinHash(passwordEncoder.encode("1234"));
                        wanasAdmin.setFullName("Alaa Harb");
                        wanasAdmin.setRole(Role.ADMIN);
                        userRepository.save(wanasAdmin);
                    } else if (wanasAdmin.getPinHash() == null) {
                        wanasAdmin.setPinHash(passwordEncoder.encode("1234"));
                        userRepository.save(wanasAdmin);
                    }
                    User cashier = userRepository.findByTenantIdAndUsername(wanasTenant.getId(), "cashier1").orElse(null);
                    if (cashier == null) {
                        cashier = new User();
                        cashier.setUsername("cashier1");
                        cashier.setPasswordHash(passwordEncoder.encode("123456"));
                        cashier.setPinHash(passwordEncoder.encode("123456"));
                        cashier.setFullName("كاشير 1");
                        cashier.setRole(Role.CASHIER);
                        userRepository.save(cashier);
                    } else if (cashier.getPinHash() == null) {
                        cashier.setPinHash(passwordEncoder.encode("123456"));
                        userRepository.save(cashier);
                    }
                } finally {
                    TenantContext.clear();
                }
            }
        } catch (Exception e) {
            System.err.println("[SEEDER] Wanas bootstrap check: " + e.getMessage());
        }

        // Repair the standard coffee recipe for existing tenant databases. This is idempotent
        // and only touches the two exact seeded Turkish-coffee product names.
        try {
            for (Tenant tenant : tenantRepository.findAll()) {
                try {
                    TenantContext.set(tenant.getId());
                    shiftAuditService.ensureDefaultCoffeeRecipes();
                } catch (Exception e) {
                    System.err.println("[SEEDER] Coffee recipe repair skipped for " + tenant.getSlug() + ": " + e.getMessage());
                } finally {
                    TenantContext.clear();
                }
            }
        } catch (Exception e) {
            // A fresh/test database may not have its schema yet. Never prevent the application
            // from starting because an idempotent data repair could not run.
            System.err.println("[SEEDER] Coffee recipe repair deferred: " + e.getMessage());
        }
    }
}
