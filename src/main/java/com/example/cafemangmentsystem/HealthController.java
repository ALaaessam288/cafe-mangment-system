package com.example.cafemangmentsystem;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.lang.management.ManagementFactory;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
public class HealthController {

    @GetMapping("/api/health")
    public Map<String, Object> health() {
        Map<String, Object> health = new LinkedHashMap<>();
        health.put("status", "UP");
        health.put("service", "Caffio Enterprise SaaS Engine");
        health.put("version", "2.5.0-ENTERPRISE");
        health.put("database", "SQLite (WAL Mode - 5000ms Timeout)");
        health.put("uptimeSeconds", ManagementFactory.getRuntimeMXBean().getUptime() / 1000);
        health.put("timestamp", Instant.now().toString());
        return health;
    }
}
