import client from './client';

export const platformApi = {
  // ── Tenant management ───────────────────────────────────────────────────────
  getAllTenants: async () => {
    const { data } = await client.get('/admin/tenants');
    return data;
  },
  provisionTenant: async (payload) => {
    const { data } = await client.post('/admin/tenants/provision', payload);
    return data;
  },
  updateSubscription: async (tenantId, payload) => {
    const { data } = await client.put(`/admin/tenants/${tenantId}/subscription`, payload);
    return data;
  },
  updateQuotas: async (tenantId, payload) => {
    const { data } = await client.put(`/admin/tenants/${tenantId}/quotas`, payload);
    return data;
  },
  customizeTenantPlan: async (tenantId, payload) => {
    const { data } = await client.put(`/admin/tenants/${tenantId}/customize-plan`, payload);
    return data;
  },
  deleteTenant: async (tenantId) => {
    const { data } = await client.delete(`/admin/tenants/${tenantId}`);
    return data;
  },
  getTenantUsage: async (tenantId) => {
    const { data } = await client.get(`/admin/tenants/${tenantId}/usage`);
    return data;
  },
  getTenantActivityLog: async (tenantId) => {
    const { data } = await client.get(`/admin/tenants/${tenantId}/activity-log`);
    return data;
  },
  getPlatformStats: async () => {
    const { data } = await client.get('/admin/tenants/stats');
    return data;
  },

  // ── License keys ────────────────────────────────────────────────────────────
  getLicenseKeys: async () => {
    const { data } = await client.get('/admin/licenses');
    return data;
  },
  generateLicenseKey: async (plan, validDays = 365, notes = '') => {
    const { data } = await client.post('/admin/licenses', { plan, validDays, notes });
    return data;
  },
  revokeLicenseKey: async (id) => {
    const { data } = await client.delete(`/admin/licenses/${id}/revoke`);
    return data;
  },
  activateLicenseKey: async (key, tenantId) => {
    const { data } = await client.post('/admin/licenses/activate', { key, tenantId });
    return data;
  },

  // ── Public (no auth) ────────────────────────────────────────────────────────
  validateLicenseKey: async (key) => {
    const { data } = await client.get('/license/validate', { params: { key } });
    return data;
  },
};
