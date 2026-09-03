import client from './client';

/*
 * Platform-owner operations.
 *
 * The subscription half was rewritten alongside the backend. The old surface had three overlapping
 * endpoints — updateSubscription, updateQuotas and customizeTenantPlan — whose effects on a
 * tenant's quotas contradicted each other: one reset them to the plan's defaults, another left
 * stale custom values in place. Each call here now maps to exactly one server-side operation.
 */
export const platformApi = {
  // ── Tenants ─────────────────────────────────────────────────────────────────
  getAllTenants: async () => (await client.get('/admin/tenants')).data,

  provisionTenant: async (payload) => (await client.post('/admin/tenants/provision', payload)).data,

  deleteTenant: async (tenantId) => (await client.delete(`/admin/tenants/${tenantId}`)).data,

  getTenantUsage: async (tenantId) => (await client.get(`/admin/tenants/${tenantId}/usage`)).data,

  getTenantActivityLog: async (tenantId) =>
    (await client.get(`/admin/tenants/${tenantId}/activity-log`)).data,

  getPlatformActivityLog: async () => (await client.get('/admin/tenants/activity-log')).data,

  getPlatformStats: async () => (await client.get('/admin/tenants/stats')).data,

  /** Tenant preferences — service charge, WhatsApp alerts. Not commercial terms. */
  updateSettings: async (tenantId, payload) =>
    (await client.put(`/admin/tenants/${tenantId}/settings`, payload)).data,

  // ── Subscription ────────────────────────────────────────────────────────────

  getSubscription: async (tenantId) =>
    (await client.get(`/admin/tenants/${tenantId}/subscription`)).data,

  getSubscriptionHistory: async (tenantId) =>
    (await client.get(`/admin/tenants/${tenantId}/subscription/history`)).data,

  /**
   * Opens a new period on a plan. Omitting the max* fields means "use the plan's own limits",
   * which is how a previous bespoke deal is deliberately discarded.
   */
  changePlan: async (tenantId, payload) =>
    (await client.put(`/admin/tenants/${tenantId}/subscription/plan`, payload)).data,

  extendSubscription: async (tenantId, days, invoice = false, note = null) =>
    (await client.post(`/admin/tenants/${tenantId}/subscription/extend`, { days, invoice, note })).data,

  renewSubscription: async (tenantId) =>
    (await client.post(`/admin/tenants/${tenantId}/subscription/renew`)).data,

  /** Bespoke limits. -1 is unlimited; null clears the override and falls back to the plan. */
  setQuotaOverrides: async (tenantId, payload) =>
    (await client.put(`/admin/tenants/${tenantId}/subscription/overrides`, payload)).data,

  setGraceDays: async (tenantId, graceDays) =>
    (await client.put(`/admin/tenants/${tenantId}/subscription/grace`, { graceDays })).data,

  cancelSubscription: async (tenantId, reason) =>
    (await client.post(`/admin/tenants/${tenantId}/subscription/cancel`, { reason })).data,

  suspendTenant: async (tenantId, reason) =>
    (await client.post(`/admin/tenants/${tenantId}/suspend`, { reason })).data,

  resumeTenant: async (tenantId) => (await client.post(`/admin/tenants/${tenantId}/resume`)).data,

  // ── Licence keys ────────────────────────────────────────────────────────────
  getLicenseKeys: async () => (await client.get('/admin/licenses')).data,

  /**
   * @param planCode          which plan the key sells
   * @param durationDays      how much subscription redeeming it grants (0 = perpetual)
   * @param redeemableForDays how long the key may be redeemed — a separate concern from the
   *                          duration it grants, which is the whole point of the split
   */
  generateLicenseKey: async ({ planCode, durationDays = 365, redeemableForDays = null,
                               maxActivations = 1, price = null, notes = '' }) =>
    (await client.post('/admin/licenses', {
      planCode, durationDays, redeemableForDays, maxActivations, price, notes,
    })).data,

  revokeLicenseKey: async (id, reason = null) =>
    (await client.post(`/admin/licenses/${id}/revoke`, { reason })).data,

  activateLicenseKey: async (key, tenantId) =>
    (await client.post('/admin/licenses/activate', { key, tenantId })).data,

  // ── Public ──────────────────────────────────────────────────────────────────
  validateLicenseKey: async (key) =>
    (await client.get('/license/validate', { params: { key } })).data,
};
