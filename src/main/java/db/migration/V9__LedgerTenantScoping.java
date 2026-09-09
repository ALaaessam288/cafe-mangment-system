package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;

/**
 * Adds {@code financial_ledger_entries.tenant_id}.
 *
 * <p>{@code FinancialLedgerEntry} extended {@code BaseEntity} instead of {@code TenantScopedEntity},
 * so every P&amp;L/cash-flow report and {@code listEntries()} summed and listed every tenant's
 * entries together - one café's revenue, refunds and payroll were mixed into every other café's
 * numbers, with no tenant filter anywhere in the query path.
 *
 * <p>A plain {@code .sql} migration can't add this as a single portable statement: Postgres allows
 * {@code ADD COLUMN ... NOT NULL} with no default only on an empty table, which this one is, but
 * SQLite refuses a {@code NOT NULL} column addition without a default unconditionally, and has no
 * {@code ALTER COLUMN ... SET NOT NULL} at all to add the constraint in a second step. SQLite gets
 * the column without the constraint instead: every desktop install is already single-tenant (see
 * {@code application-prod.properties}), so a nullable column there loses nothing in practice, and
 * Hibernate's {@code @TenantId} still stamps every insert with the real tenant id regardless.
 */
public class V9__LedgerTenantScoping extends BaseJavaMigration {

    @Override
    public void migrate(Context context) throws Exception {
        Connection connection = context.getConnection();
        boolean postgres = "PostgreSQL".equals(connection.getMetaData().getDatabaseProductName());

        if (!hasColumn(connection, "financial_ledger_entries", "tenant_id")) {
            try (Statement statement = connection.createStatement()) {
                statement.execute("ALTER TABLE financial_ledger_entries ADD COLUMN tenant_id BIGINT"
                        + (postgres ? " REFERENCES tenants(id) ON DELETE CASCADE" : ""));
            }
        }

        if (postgres) {
            long rows;
            try (Statement statement = connection.createStatement();
                 ResultSet rs = statement.executeQuery(
                         "SELECT COUNT(*) AS c FROM financial_ledger_entries WHERE tenant_id IS NULL")) {
                rs.next();
                rows = rs.getLong("c");
            }
            if (rows > 0) {
                throw new IllegalStateException(
                        "financial_ledger_entries has " + rows + " row(s) with no tenant_id - back "
                        + "fill them by hand (they predate tenant scoping and their real tenant "
                        + "can't be recovered automatically) before this migration can enforce NOT NULL.");
            }
            try (Statement statement = connection.createStatement()) {
                statement.execute("ALTER TABLE financial_ledger_entries ALTER COLUMN tenant_id SET NOT NULL");
            }
        }

        try (Statement statement = connection.createStatement()) {
            statement.execute(
                    "CREATE INDEX IF NOT EXISTS idx_ledger_tenant_occurred "
                    + "ON financial_ledger_entries (tenant_id, occurred_at)");
        }
    }

    private boolean hasColumn(Connection connection, String table, String column) throws Exception {
        if ("SQLite".equals(connection.getMetaData().getDatabaseProductName())) {
            try (Statement statement = connection.createStatement();
                 ResultSet rs = statement.executeQuery("PRAGMA table_info(" + table + ")")) {
                while (rs.next()) {
                    if (column.equalsIgnoreCase(rs.getString("name"))) return true;
                }
            }
            return false;
        }
        try (Statement statement = connection.createStatement();
             ResultSet rs = statement.executeQuery(
                     "SELECT column_name FROM information_schema.columns "
                     + "WHERE table_name = '" + table + "' AND column_name = '" + column + "'")) {
            return rs.next();
        }
    }
}
