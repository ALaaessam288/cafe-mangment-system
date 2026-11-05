import { defineConfig } from "@neon/config/v1";

/*
 * Neon services for Caffio: Postgres only.
 *
 * Postgres is on by default for every Neon project, so nothing is declared for it here.
 * Auth and Realtime were left out on purpose: Caffio has its own login (JWT, cashier PINs, roles,
 * per-cafe tenants) in the Spring backend, and Realtime needs a Node service to authorise live
 * queries, which this Java backend does not have.
 */
export default defineConfig({
  // Branch policy: per-branch tuning
  branch: (branch) => {
    if (branch.isDefault) {
      // Default branch (production): no overrides, uses project defaults
      return {};
    }
    if (!branch.exists) {
      // New non-default branches auto-expire after a week.
      // Run `neon checkout <name> --create` to create one with these settings.
      return { ttl: "7d" };
    }
    // Existing branch: no changes
    return {};
  },
});
