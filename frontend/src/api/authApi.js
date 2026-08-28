import client from './client';

export const authApi = {
  login: (tenantSlug, username, password) =>
    client.post('/auth/login', { tenantSlug, username: username || undefined, password }).then((r) => r.data),

  loginPin: (tenantSlug, pin) =>
    client.post('/auth/login-pin', { tenantSlug, pin }).then((r) => r.data),

  getTenantUsers: (tenantSlug) =>
    client.get('/auth/tenant-users', { params: { tenantSlug } }).then((r) => r.data),

  refresh: (refreshToken) =>
    client.post('/auth/refresh', { refreshToken }).then((r) => r.data),

  logout: (refreshToken) =>
    client.post('/auth/logout', { refreshToken }).then((r) => r.data),

  getTenants: () =>
    client.get('/auth/tenants').then((r) => r.data),

  loginSuperAdmin: (username, password) =>
    client.post('/auth/super-admin/login', { username, password }).then((r) => r.data),
};
