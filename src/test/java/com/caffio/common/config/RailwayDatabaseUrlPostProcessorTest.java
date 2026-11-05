package com.caffio.common.config;

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

    /**
     * Every other test here calls the converter directly, which is how it went unnoticed that Spring
     * never did. It was listed in a .imports file Boot does not read for post-processors, so a
     * postgresql:// DATABASE_URL reached the SQLite driver unconverted. This asks Spring's own loader.
     */
    @Test
    void springDiscoversTheConverterAtStartup() {
        // Names only: Boot's own entries need constructor arguments only a running app supplies.
        // Each spring.factories file is read on its own - merging them keeps one value per key.
        java.util.List<String> registered = new java.util.ArrayList<>();
        String key = org.springframework.boot.EnvironmentPostProcessor.class.getName();
        try {
            var files = getClass().getClassLoader()
                    .getResources(org.springframework.core.io.support.SpringFactoriesLoader.FACTORIES_RESOURCE_LOCATION);
            while (files.hasMoreElements()) {
                java.util.Properties p = new java.util.Properties();
                try (var in = files.nextElement().openStream()) { p.load(in); }
                for (String name : p.getProperty(key, "").split(",")) registered.add(name.trim());
            }
        } catch (java.io.IOException e) {
            throw new AssertionError(e);
        }

        assertThat(registered).contains(RailwayDatabaseUrlPostProcessor.class.getName());
    }
}
