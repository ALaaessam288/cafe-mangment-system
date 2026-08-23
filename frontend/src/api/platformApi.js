import client from './client';

export const platformApi = {
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
  getTenantActivityLog: async (tenantId) => {
    const { data } = await client.get(`/admin/tenants/${tenantId}/activity-log`);
    return data;
  },
};
