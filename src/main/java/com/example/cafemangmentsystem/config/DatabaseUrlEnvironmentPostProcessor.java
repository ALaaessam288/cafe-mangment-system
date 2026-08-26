package com.example.cafemangmentsystem.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.net.URI;
import java.util.HashMap;
import java.util.Map;

/**
 * Railway (and Heroku-style) Postgres plugins inject DATABASE_URL as a URI
 * ("postgresql://user:pass@host:port/db"), but Spring's DriverManagerDataSource
 * needs a JDBC URL ("jdbc:postgresql://host:port/db"). This rewrites it before
 * spring.datasource.* properties are resolved, so application.properties can
 * keep using ${DATABASE_URL:...} unchanged.
 */
public class DatabaseUrlEnvironmentPostProcessor implements EnvironmentPostProcessor {

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        String databaseUrl = environment.getProperty("DATABASE_URL");
        if (databaseUrl == null || databaseUrl.isBlank() || databaseUrl.startsWith("jdbc:")) {
            return;
        }

        try {
            URI uri = URI.create(databaseUrl);
            String userInfo = uri.getUserInfo();
            String username = null;
            String password = null;
            if (userInfo != null) {
                String[] parts = userInfo.split(":", 2);
                username = parts[0];
                password = parts.length > 1 ? parts[1] : "";
            }

            StringBuilder jdbcUrl = new StringBuilder("jdbc:postgresql://")
                    .append(uri.getHost());
            if (uri.getPort() > 0) {
                jdbcUrl.append(":").append(uri.getPort());
            }
            jdbcUrl.append(uri.getPath());
            if (uri.getQuery() != null) {
                jdbcUrl.append("?").append(uri.getQuery());
            }

            Map<String, Object> overrides = new HashMap<>();
            overrides.put("spring.datasource.url", jdbcUrl.toString());
            if (username != null) {
                overrides.put("spring.datasource.username", username);
            }
            if (password != null) {
                overrides.put("spring.datasource.password", password);
            }

            environment.getPropertySources().addFirst(new MapPropertySource("railwayDatabaseUrl", overrides));
        } catch (IllegalArgumentException e) {
            // Malformed DATABASE_URL: leave it untouched so Spring fails fast with a clear datasource error.
        }
    }
}
