package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.sql.Connection;
import java.sql.Statement;

/**
 * Make a product, a category and a table deletable outright, without taking the history with them.
 *
 * <p>Deleting a sold product used to be refused, because order_items.product_id is a foreign key
 * with no cascade. The refusal was protecting the wrong thing. An order line does NOT need its
 * product row: it was written with product_name_snapshot, category_name_snapshot,
 * unit_price_snapshot, station_snapshot and revenue_line_snapshot precisely so that a later price
 * change, rename or deletion could never rewrite what a customer was actually charged. Every report
 * on this system - revenue, the shift close-out, the Z-report, the best-sellers list - reads those
 * snapshots. The product row is only needed to re-order the item, and a deleted product is not
 * going to be re-ordered.
 *
 * <p>So the FK becomes ON DELETE SET NULL and the column becomes nullable. The line keeps every
 * figure and every name; it simply stops pointing at a menu entry that no longer exists. The Java
 * side already expects this - OrderService and ShiftAuditService are full of
 * {@code if (item.getProduct() != null)} - so the nullable case was anticipated everywhere except
 * the constraint itself.
 *
 * <p>stock_adjustments is different: it has no snapshot, so a movement whose product is gone can say
 * nothing at all about what moved. Those rows go with the product. That is a real loss of an audit
 * trail, and it is the price of deleting the product rather than deactivating it.
 *
 * <p>Postgres-only, as a Java migration rather than {@code .sql}: SQLite has no
 * {@code ALTER TABLE ... DROP CONSTRAINT} or {@code ALTER COLUMN ... SET/DROP NOT NULL} at all, and
 * doesn't need either - this app never turns on {@code PRAGMA foreign_keys}, so SQLite was never
 * enforcing these constraints to begin with. A plain {@code .sql} file can't skip itself per engine
 * (see {@code V2_1__SqliteLegacyCompat}'s docstring), so this has to be Java.
 */
public class V11__ForceDeleteConstraints extends BaseJavaMigration {

    @Override
    public void migrate(Context context) throws Exception {
        Connection connection = context.getConnection();
        if (!"PostgreSQL".equals(connection.getMetaData().getDatabaseProductName())) {
            return;
        }

        try (Statement statement = connection.createStatement()) {
            // order_items: keep the line, drop the pointer.
            statement.execute("ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_product_id_fkey");
            statement.execute("ALTER TABLE order_items ALTER COLUMN product_id DROP NOT NULL");
            statement.execute("ALTER TABLE order_items ADD CONSTRAINT order_items_product_id_fkey "
                    + "FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL");

            // stock_adjustments: the movement goes with the product.
            statement.execute("ALTER TABLE stock_adjustments DROP CONSTRAINT IF EXISTS "
                    + "stock_adjustments_product_id_fkey");
            statement.execute("ALTER TABLE stock_adjustments ADD CONSTRAINT "
                    + "stock_adjustments_product_id_fkey FOREIGN KEY (product_id) "
                    + "REFERENCES products(id) ON DELETE CASCADE");

            // products.category_id: a deleted category leaves its products uncategorised. Not
            // cascade - deleting a category must never be a way to delete a menu by accident; the
            // products survive it and surface under "غير مصنّف", which the POS grid already groups
            // and draws.
            statement.execute("ALTER TABLE products DROP CONSTRAINT IF EXISTS products_category_id_fkey");
            statement.execute("ALTER TABLE products ALTER COLUMN category_id DROP NOT NULL");
            statement.execute("ALTER TABLE products ADD CONSTRAINT products_category_id_fkey "
                    + "FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL");

            // orders.table_id is already ON DELETE SET NULL (V1), so a table needs no constraint
            // change: a past order keeps its table_number snapshot and simply stops pointing at a
            // table that is gone.
        }
    }
}
