package com.example.cafemangmentsystem;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.lang.management.ManagementFactory;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Liveness probe. The packaged desktop shell polls this to decide when to show its window.
 *
 * <p>The database line used to be the literal string "SQLite (WAL Mode - 5000ms Timeout)",
 * hardcoded — so a cloud deployment running on PostgreSQL reported SQLite, which is exactly the
 * kind of thing you check a health endpoint to find out. It now asks the connection.
 */
@RestController
@RequiredArgsConstructor
@Slf4j
public class HealthController {

    private final DataSource dataSource;

    @GetMapping("/api/health")
    public Map<String, Object> health() {
        Map<String, Object> health = new LinkedHashMap<>();
        health.put("status", "UP");
        health.put("service", "Caffio Enterprise SaaS Engine");
        health.put("version", "2.5.0-ENTERPRISE");
        health.put("database", describeDatabase());
        health.put("uptimeSeconds", ManagementFactory.getRuntimeMXBean().getUptime() / 1000);
        health.put("timestamp", Instant.now().toString());
        return health;
    }

    /**
     * Names the engine actually in use. Deliberately reports the product and version only — never
     * the JDBC URL, which carries the host and sometimes the credentials, and this endpoint is
     * unauthenticated.
     */
    private String describeDatabase() {
        try (Connection connection = dataSource.getConnection()) {
            DatabaseMetaData metaData = connection.getMetaData();
            return metaData.getDatabaseProductName() + " " + metaData.getDatabaseProductVersion();
        } catch (Exception unreachable) {
            log.warn("Health check could not reach the database", unreachable);
            return "unavailable";
        }
    }
}
