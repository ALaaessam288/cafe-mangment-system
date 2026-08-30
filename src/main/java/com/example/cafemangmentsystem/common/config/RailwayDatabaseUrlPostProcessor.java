package com.example.cafemangmentsystem.common.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.util.HashMap;
import java.util.Map;
import java.net.URI;

/**
 * Railway injects DATABASE_URL as "postgresql://user:pass@host:5432/db".
 * Spring's JDBC driver needs "jdbc:postgresql://..." — this processor
 * adds the prefix at startup if it's missing.
 */
public class RailwayDatabaseUrlPostProcessor implements EnvironmentPostProcessor {

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment,
                                       SpringApplication application) {
        String url = environment.getProperty("DATABASE_URL");
        if (url != null && (url.startsWith("postgresql://") || url.startsWith("postgres://"))) {
            try {
                URI parsed = URI.create(url.replaceFirst("^postgres(?:ql)?://", "http://"));
                if (parsed.getHost() == null || parsed.getRawPath() == null) {
                    return;
                }
                String jdbcUrl = "jdbc:postgresql://" + parsed.getHost()
                        + (parsed.getPort() >= 0 ? ":" + parsed.getPort() : "")
                        + parsed.getRawPath()
                        + (parsed.getRawQuery() != null ? "?" + parsed.getRawQuery() : "");

                Map<String, Object> map = new HashMap<>();
                map.put("DATABASE_URL", jdbcUrl);
                map.put("spring.datasource.url", jdbcUrl);
                if (parsed.getUserInfo() != null) {
                    String[] credentials = parsed.getUserInfo().split(":", 2);
                    map.put("spring.datasource.username", credentials[0]);
                    if (credentials.length == 2) {
                        map.put("spring.datasource.password", credentials[1]);
                    }
                }
                map.put("spring.datasource.driver-class-name", "org.postgresql.Driver");
                map.put("spring.jpa.database-platform", "org.hibernate.dialect.PostgreSQLDialect");
                map.put("spring.jpa.properties.hibernate.dialect", "org.hibernate.dialect.PostgreSQLDialect");

                environment.getPropertySources()
                        .addFirst(new MapPropertySource("railwayUrlFix", map));
            } catch (IllegalArgumentException ignored) {
                // Leave malformed values untouched so Spring can report the configuration error.
            }
        }
    }
}
