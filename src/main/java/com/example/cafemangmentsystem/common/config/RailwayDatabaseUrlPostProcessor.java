package com.example.cafemangmentsystem.common.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.util.HashMap;
import java.util.Map;

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
        if (url != null && url.startsWith("postgresql://")) {
            String jdbcUrl = "jdbc:postgresql://" + url.substring("postgresql://".length());
            Map<String, Object> map = new HashMap<>();
            map.put("DATABASE_URL", jdbcUrl);
            environment.getPropertySources()
                    .addFirst(new MapPropertySource("railwayUrlFix", map));
        }
    }
}
