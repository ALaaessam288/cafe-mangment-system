package com.example.cafemangmentsystem;

import com.example.cafemangmentsystem.tenant.TenantService;
import com.example.cafemangmentsystem.tenant.repository.TenantRepository;
import com.example.cafemangmentsystem.tenant.platform.dto.ProvisionTenantRequest;
import com.example.cafemangmentsystem.tenant.entity.BusinessType;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.jdbc.core.JdbcTemplate;

@Component
public class DatabaseSeeder implements CommandLineRunner {

    private final TenantRepository tenantRepository;
    private final TenantService tenantService;
    private final JdbcTemplate jdbcTemplate;

    public DatabaseSeeder(TenantRepository tenantRepository, TenantService tenantService, JdbcTemplate jdbcTemplate) {
        this.tenantRepository = tenantRepository;
        this.tenantService = tenantService;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(String... args) throws Exception {
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

        if (tenantRepository.count() == 0) {
            System.out.println("[SEEDER] Database is empty. Seeding default tenants...");
            
            // 1. Seed tenant wanas
            try {
                ProvisionTenantRequest req1 = new ProvisionTenantRequest(
                    "Wanas Cafe",
                    "wanas",
                    BusinessType.CAFE,
                    "admin",
                    "password123",
                    "Admin User",
                    "Africa/Cairo",
                    "EGP"
                );
                tenantService.provision(req1);
                System.out.println("[SEEDER] Default tenant 'wanas' seeded successfully!");
            } catch (Exception e) {
                System.err.println("[SEEDER] Failed to seed 'wanas': " + e.getMessage());
            }

            // 2. Seed tenant wanas-cafe (for jeox user)
            try {
                ProvisionTenantRequest req2 = new ProvisionTenantRequest(
                    "ونس",
                    "wanas-cafe",
                    BusinessType.CAFE,
                    "jeox",
                    "12345678",
                    "Jeo X",
                    "Africa/Cairo",
                    "EGP"
                );
                tenantService.provision(req2);
                System.out.println("[SEEDER] Default tenant 'wanas-cafe' seeded successfully!");
            } catch (Exception e) {
                System.err.println("[SEEDER] Failed to seed 'wanas-cafe': " + e.getMessage());
            }
        }
    }
}
