package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;

/**
 * Drops every V3/V4/V5/V6 table on Postgres that {@code JPA_DDL_AUTO=update} already created from
 * the entity mapping before {@link com.example.cafemangmentsystem.common.config.FlywayConfig} was
 * fixed to run Flyway ahead of Hibernate.
 *
 * <p>Before that fix, Hibernate always won the race: it created each new entity's table straight
 * from the mapping - no column defaults, no CHECK constraints, no partial unique indexes, none of
 * which come from annotations - and every migration's own {@code CREATE TABLE IF NOT EXISTS} then
 * silently no-opped against that wrong shape instead of building the real one. {@code plans} hit
 * this first (missing {@code created_at}/{@code updated_at} defaults broke the seed INSERT), but
 * ddl-auto=update processes the whole persistence unit at once, so every other new table from this
 * work is equally suspect even where the symptom hasn't surfaced yet.
 *
 * <p>Dropping unconditionally is only safe because every one of these tables is confirmed empty in
 * production as of the query that led to this migration - nothing has had a chance to write to a
 * feature that was never live. Each check re-verifies that before dropping, and refuses (loudly)
 * rather than silently destroying data if that's ever no longer true - e.g. on some other
 * environment that reaches this migration after actually using one of these tables.
 *
 * <p>{@code financial_ledger_entries} isn't here: V2 already ran successfully against Hibernate's
 * version of it (their schemas happened to agree closely enough), so it's already correct.
 * {@code license_keys} is included even though {@code V2_2__PostgresLegacyCompat} also touches it -
 * that migration only drops it if it's still in the pre-billing shape; if Hibernate had partially
 * reconciled it toward the new shape first (e.g. by adding {@code plan_id}) V2_2 would have mistaken
 * it for already-correct and left it alone, so this is a second, shape-agnostic pass.
 */
public class V2_3__DropStrayHibernateShapedTables extends BaseJavaMigration {

    private static final String[] TABLES = {
            "license_key_activations",
            "license_keys",
            "subscription_payments",
            "subscription_invoices",
            "tenant_subscriptions",
            "plan_features",
            "plans",
            "upgrade_requests",
            "raw_material_movements",
            "idempotency_records",
    };

    @Override
    public void migrate(Context context) throws Exception {
        Connection connection = context.getConnection();
        if (!"PostgreSQL".equals(connection.getMetaData().getDatabaseProductName())) {
            return;
        }

        for (String table : TABLES) {
            dropIfEmpty(connection, table);
        }
    }

    private void dropIfEmpty(Connection connection, String table) throws Exception {
        if (!tableExists(connection, table)) {
            return;
        }

        long rows;
        try (Statement statement = connection.createStatement();
             ResultSet rs = statement.executeQuery("SELECT COUNT(*) AS c FROM " + table)) {
            rs.next();
            rows = rs.getLong("c");
        }

        if (rows > 0) {
            throw new IllegalStateException(
                    table + " already exists (created by ddl-auto=update before Flyway was fixed to "
                    + "run first) and holds " + rows + " row(s). This migration only knows how to "
                    + "replace an EMPTY stray table - migrate its data by hand, drop the table, then "
                    + "rerun.");
        }

        try (Statement statement = connection.createStatement()) {
            statement.execute("DROP TABLE " + table);
        }
    }

    private boolean tableExists(Connection connection, String table) throws Exception {
        try (Statement statement = connection.createStatement();
             ResultSet rs = statement.executeQuery("SELECT to_regclass('" + table + "') AS t")) {
            rs.next();
            return rs.getString("t") != null;
        }
    }
}
