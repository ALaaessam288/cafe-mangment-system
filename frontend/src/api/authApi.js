import client from './client';

export const authApi = {
  login: (tenantSlug, username, password) =>
    client.post('/auth/login', { tenantSlug, username: username || undefined, password }).then((r) => r.data),

  loginPin: (tenantSlug, pin) =>
    client.post('/auth/login-pin', { tenantSlug, pin }).then((r) => r.data),

  refresh: (refreshToken) =>
    client.post('/auth/refresh', { refreshToken }).then((r) => r.data),

  logout: (refreshToken) =>
    client.post('/auth/logout', { refreshToken }).then((r) => r.data),

  getTenants: () =>
    client.get('/auth/tenants').then((r) => r.data),

  loginSuperAdmin: (username, password) =>
    client.post('/auth/super-admin/login', { username, password }).then((r) => r.data),

  /*
   * Public self-service signup. Creates the tenant on the free trial and returns a token, so the
   * owner lands inside the app rather than on a login form they have not been told the details for.
   */
  registerTrial: (payload) =>
    client.post('/auth/register-trial', payload).then((r) => r.data),

  /** Checked as the customer types, so a taken workspace address is caught before submitting. */
  slugAvailable: (slug) =>
    client.get('/auth/slug-available', { params: { slug } }).then((r) => r.data),
};
