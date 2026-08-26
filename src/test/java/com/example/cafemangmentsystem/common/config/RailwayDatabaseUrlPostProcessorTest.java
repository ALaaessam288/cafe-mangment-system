package com.example.cafemangmentsystem.common.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringApplication;
import org.springframework.mock.env.MockEnvironment;

import static org.assertj.core.api.Assertions.assertThat;

class RailwayDatabaseUrlPostProcessorTest {

    private final RailwayDatabaseUrlPostProcessor processor = new RailwayDatabaseUrlPostProcessor();

    @Test
    void rewritesPostgresqlSchemeToJdbcUrlAndExtractsCredentials() {
        MockEnvironment environment = new MockEnvironment();
        environment.setProperty("DATABASE_URL", "postgresql://myuser:mypass@containers-us-west.railway.app:5432/railway");

        processor.postProcessEnvironment(environment, new SpringApplication());

        assertThat(environment.getProperty("spring.datasource.url"))
                .isEqualTo("jdbc:postgresql://containers-us-west.railway.app:5432/railway");
        assertThat(environment.getProperty("spring.datasource.username")).isEqualTo("myuser");
        assertThat(environment.getProperty("spring.datasource.password")).isEqualTo("mypass");
    }

    @Test
    void rewritesPostgresSchemeVariant() {
        MockEnvironment environment = new MockEnvironment();
        environment.setProperty("DATABASE_URL", "postgres://myuser:mypass@host:5432/db");

        processor.postProcessEnvironment(environment, new SpringApplication());

        assertThat(environment.getProperty("spring.datasource.url"))
                .isEqualTo("jdbc:postgresql://host:5432/db");
    }

    @Test
    void preservesQueryStringParameters() {
        MockEnvironment environment = new MockEnvironment();
        environment.setProperty("DATABASE_URL", "postgresql://user:pass@host:5432/db?sslmode=require");

        processor.postProcessEnvironment(environment, new SpringApplication());

        assertThat(environment.getProperty("spring.datasource.url"))
                .isEqualTo("jdbc:postgresql://host:5432/db?sslmode=require");
    }

    @Test
    void leavesAlreadyJdbcUrlUntouched() {
        MockEnvironment environment = new MockEnvironment();
        environment.setProperty("DATABASE_URL", "jdbc:postgresql://host:5432/db");

        processor.postProcessEnvironment(environment, new SpringApplication());

        assertThat(environment.getPropertySources().contains("railwayDatabaseUrl")).isFalse();
    }

    @Test
    void leavesSqliteFallbackUntouchedWhenDatabaseUrlAbsent() {
        MockEnvironment environment = new MockEnvironment();

        processor.postProcessEnvironment(environment, new SpringApplication());

        assertThat(environment.getPropertySources().contains("railwayDatabaseUrl")).isFalse();
    }

    @Test
    void doesNotBlowUpOnMalformedUrl() {
        MockEnvironment environment = new MockEnvironment();
        environment.setProperty("DATABASE_URL", "postgresql://[invalid");

        processor.postProcessEnvironment(environment, new SpringApplication());

        assertThat(environment.getPropertySources().contains("railwayDatabaseUrl")).isFalse();
    }
}
