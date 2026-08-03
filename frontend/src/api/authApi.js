import client from './client';

export const authApi = {
  login: (tenantSlug, username, password) =>
    client.post('/auth/login', { tenantSlug, username, password }).then((r) => r.data),

  refresh: (refreshToken) =>
    client.post('/auth/refresh', { refreshToken }).then((r) => r.data),

  logout: (refreshToken) =>
    client.post('/auth/logout', { refreshToken }).then((r) => r.data),

  getTenants: () =>
    client.get('/auth/tenants').then((r) => r.data),
};
