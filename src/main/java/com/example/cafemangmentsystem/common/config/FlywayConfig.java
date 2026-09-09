package com.example.cafemangmentsystem.common.config;

import jakarta.persistence.EntityManagerFactory;
import org.flywaydb.core.Flyway;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.beans.factory.config.ConfigurableListableBeanFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.ObjectUtils;

import javax.sql.DataSource;
import java.sql.Connection;
import java.util.Map;

/**
 * Runs the {@code db/migration} scripts by hand.
 *
 * <p>This Spring Boot version ships no Flyway auto-configuration - {@code flyway-core} on the
 * classpath alone does nothing, silently, because
 * {@code org.springframework.boot.autoconfigure.AutoConfiguration.imports} in this release has no
 * Flyway entry to trigger it. The {@code spring.flyway.*} properties are consequently dead unless
 * something reads them itself, which is what this bean does.
 *
 * <p>Depending on {@link DataSource} forces this bean, and therefore the migration, to run during
 * context refresh before any {@code ApplicationRunner} (the plan/tenant seeders included) gets a
 * chance to query a table that doesn't exist yet. It does NOT, by itself, run before Hibernate's own
 * schema management - that ordering is what {@link #entityManagerFactoryDependsOnFlyway} adds. Real
 * Spring Boot Flyway auto-configuration wires that dependency automatically
 * ({@code FlywayJpaDependencyConfiguration}); hand-rolling Flyway here skipped it, so whenever
 * {@code JPA_DDL_AUTO} is anything but {@code none} Hibernate was racing Flyway on every entity that
 * didn't have a row in {@code flyway_schema_history} yet - and, being wired first, always won: it
 * created each new table straight from the entity mapping (no column defaults, no CHECK constraints,
 * no partial unique indexes - none of those come from annotations), so a migration's own
 * {@code CREATE TABLE IF NOT EXISTS} for that table silently no-opped against the wrong shape.
 */
@Configuration
public class FlywayConfig {

    /**
     * Forces every {@link EntityManagerFactory} bean to wait for {@code flyway} to finish before
     * Hibernate touches the schema, so {@code JPA_DDL_AUTO=update} (or any other non-{@code none}
     * value) can never again race a migration for the same table.
     */
    @Bean
    static BeanFactoryPostProcessor entityManagerFactoryDependsOnFlyway() {
        return (ConfigurableListableBeanFactory beanFactory) -> {
            for (String name : beanFactory.getBeanNamesForType(EntityManagerFactory.class, false, false)) {
                var definition = beanFactory.getBeanDefinition(name);
                definition.setDependsOn(ObjectUtils.addObjectToArray(definition.getDependsOn(), "flyway"));
            }
        };
    }

    @Bean
    public Flyway flyway(DataSource dataSource,
                          @Value("${spring.flyway.enabled:true}") boolean enabled,
                          @Value("${spring.flyway.baseline-on-migrate:true}") boolean baselineOnMigrate,
                          @Value("${spring.flyway.locations:classpath:db/migration}") String locations) throws Exception {
        Flyway flyway = Flyway.configure()
                .dataSource(dataSource)
                .baselineOnMigrate(baselineOnMigrate)
                .locations(locations)
                .placeholders(Map.of(
                        "pk_id", primaryKeyDdl(dataSource),
                        "add_col_if_not_exists", addColumnIfNotExistsDdl(dataSource)))
                .load();
        if (enabled) {
            flyway.migrate();
        }
        return flyway;
    }

    /**
     * What "auto-incrementing primary key" has to be spelled as, per engine.
     *
     * <p>{@code BIGSERIAL} is Postgres-only; SQLite only wires up its rowid-based auto-increment
     * when a column is declared with the exact type name {@code INTEGER} (not {@code BIGINT}, not
     * {@code BIGSERIAL} - both parse as an ordinary column and every insert that omits the id then
     * stores {@code NULL}). Every migration uses {@code ${pk_id}} for its id column instead of
     * hardcoding either spelling.
     */
    private String primaryKeyDdl(DataSource dataSource) throws Exception {
        try (Connection connection = dataSource.getConnection()) {
            String product = connection.getMetaData().getDatabaseProductName();
            return switch (product) {
                case "SQLite" -> "INTEGER PRIMARY KEY";
                case "MySQL" -> "BIGINT PRIMARY KEY AUTO_INCREMENT";
                default -> "BIGSERIAL PRIMARY KEY"; // PostgreSQL and anything else Postgres-compatible
            };
        }
    }

    /**
     * SQLite's {@code ALTER TABLE ADD COLUMN} has no {@code IF NOT EXISTS} clause at all, so a
     * script using it there needs the column to genuinely never exist yet (see
     * {@code V2_1__SqliteLegacyCompat}, which guarantees exactly that by stripping it first).
     * Postgres does support the clause, and needs it here: {@code JPA_DDL_AUTO=update} can have
     * already added the column from the entity mapping - with real data in it - before this
     * migration runs, and re-adding it unconditionally would fail instead of being a no-op.
     */
    private String addColumnIfNotExistsDdl(DataSource dataSource) throws Exception {
        try (Connection connection = dataSource.getConnection()) {
            return "SQLite".equals(connection.getMetaData().getDatabaseProductName()) ? "" : "IF NOT EXISTS ";
        }
    }
}
