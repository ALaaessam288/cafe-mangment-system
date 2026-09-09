package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;

/**
 * Strips Postgres-only legacy cruft off {@code license_keys} before V3 runs.
 *
 * <p>{@link V2_1__SqliteLegacyCompat}'s docstring assumed "Postgres never has this problem
 * (every SaaS tenant starts from V1 onward)". That assumption is false wherever
 * {@code JPA_DDL_AUTO=update} has also been active against the real Postgres database (as it has
 * been here): Hibernate created {@code license_keys} from the pre-billing entity shape long before
 * V3 existed, so V3's {@code CREATE TABLE IF NOT EXISTS} would silently no-op and leave the table
 * in the wrong shape instead of the one the new entity expects.
 *
 * <p>{@code tenants.logo_url} / {@code tenants.plan_selected} don't need the same treatment here:
 * unlike license_keys' shape mismatch, those two are just individual columns Hibernate may have
 * already added with real tenant data in them (e.g. an uploaded logo) - dropping and letting V3
 * re-add them would destroy that data. V3 instead adds them with {@code IF NOT EXISTS}, which
 * Postgres supports directly, so no Java-side check is needed for those.
 */
public class V2_2__PostgresLegacyCompat extends BaseJavaMigration {

    @Override
    public void migrate(Context context) throws Exception {
        Connection connection = context.getConnection();
        if (!"PostgreSQL".equals(connection.getMetaData().getDatabaseProductName())) {
            return;
        }

        dropLegacyLicenseKeysIfEmpty(connection);
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
                     "SELECT to_regclass('" + table + "') AS t")) {
            rs.next();
            return rs.getString("t") != null;
        }
    }

    private boolean hasColumn(Connection connection, String table, String column) throws Exception {
        try (Statement statement = connection.createStatement();
             ResultSet rs = statement.executeQuery(
                     "SELECT column_name FROM information_schema.columns "
                     + "WHERE table_name = '" + table + "' AND column_name = '" + column + "'")) {
            return rs.next();
        }
    }
}
