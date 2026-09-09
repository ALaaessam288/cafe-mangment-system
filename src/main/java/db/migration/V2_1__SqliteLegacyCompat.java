package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;

/**
 * Strips SQLite-only legacy cruft off {@code tenants} and {@code license_keys} before V3 runs.
 *
 * <p>Both tables have existed since long before Flyway did, under {@code ddl-auto=update}. On a
 * desktop SQLite install that history left {@code tenants.logo_url} / {@code tenants.plan_selected}
 * already present, and {@code license_keys} sitting there with a completely different, pre-billing
 * shape - so the unconditional {@code ADD COLUMN} / {@code CREATE TABLE IF NOT EXISTS} statements
 * V3 relies on would either collide with a column that's already there or silently keep the wrong
 * {@code license_keys} schema. Postgres never has this problem (every SaaS tenant starts from V1
 * onward), which is why this only touches anything when the driver says SQLite.
 *
 * <p>Runs as its own version rather than folding the checks into V3's SQL: SQLite has no
 * {@code IF [NOT] EXISTS} on {@code ALTER TABLE ADD/DROP COLUMN}, so "is this already there" has to
 * be a real query, and plain {@code .sql} migrations can't branch.
 */
public class V2_1__SqliteLegacyCompat extends BaseJavaMigration {

    @Override
    public void migrate(Context context) throws Exception {
        Connection connection = context.getConnection();
        if (!"SQLite".equals(connection.getMetaData().getDatabaseProductName())) {
            return;
        }

        dropTenantColumnIfPresent(connection, "logo_url");
        dropTenantColumnIfPresent(connection, "plan_selected");
        dropLegacyLicenseKeysIfEmpty(connection);
    }

    /** V3 re-adds these unconditionally; on a fresh database they were never there to begin with. */
    private void dropTenantColumnIfPresent(Connection connection, String column) throws Exception {
        if (hasColumn(connection, "tenants", column)) {
            try (Statement statement = connection.createStatement()) {
                statement.execute("ALTER TABLE tenants DROP COLUMN " + column);
            }
        }
    }

    private void dropLegacyLicenseKeysIfEmpty(Connection connection) throws Exception {
        if (!tableExists(connection, "license_keys") || hasColumn(connection, "license_keys", "plan_id")) {
            // Doesn't exist yet, or is already the current shape (a rerun) - V3 handles both fine.
            return;
        }

        long rows;
        try (Statement statement = connection.createStatement();
             ResultSet rs = statement.executeQuery("SELECT COUNT(*) AS c FROM license_keys")) {
            rs.next();
            rows = rs.getLong("c");
        }

        if (rows > 0) {
            throw new IllegalStateException(
                    "license_keys predates the billing rework and holds " + rows + " row(s) in the "
                    + "old shape. This migration only knows how to replace an EMPTY legacy table - "
                    + "migrate its data by hand, drop the table, then rerun.");
        }

        try (Statement statement = connection.createStatement()) {
            statement.execute("DROP TABLE license_keys");
        }
    }

    private boolean tableExists(Connection connection, String table) throws Exception {
        try (Statement statement = connection.createStatement();
             ResultSet rs = statement.executeQuery(
                     "SELECT name FROM sqlite_master WHERE type='table' AND name='" + table + "'")) {
            return rs.next();
        }
    }

    private boolean hasColumn(Connection connection, String table, String column) throws Exception {
        if (!tableExists(connection, table)) return false;
        try (Statement statement = connection.createStatement();
             ResultSet rs = statement.executeQuery("PRAGMA table_info(" + table + ")")) {
            while (rs.next()) {
                if (column.equalsIgnoreCase(rs.getString("name"))) return true;
            }
        }
        return false;
    }
}
