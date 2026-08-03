/* ── Keys stored in localStorage ── */
const KEYS = {
  ACCESS_TOKEN:   'wanas_access_token',
  REFRESH_TOKEN:  'wanas_refresh_token',
  TENANT_SLUG:    'wanas_tenant_slug',
  USER:           'wanas_user',
};

export const storage = {
  /* Access Token */
  getAccessToken:    () => localStorage.getItem(KEYS.ACCESS_TOKEN),
  setAccessToken:    (token) => localStorage.setItem(KEYS.ACCESS_TOKEN, token),
  removeAccessToken: () => localStorage.removeItem(KEYS.ACCESS_TOKEN),

  /* Refresh Token */
  getRefreshToken:    () => localStorage.getItem(KEYS.REFRESH_TOKEN),
  setRefreshToken:    (token) => localStorage.setItem(KEYS.REFRESH_TOKEN, token),
  removeRefreshToken: () => localStorage.removeItem(KEYS.REFRESH_TOKEN),

  /* Tenant Slug */
  getTenantSlug:    () => localStorage.getItem(KEYS.TENANT_SLUG),
  setTenantSlug:    (slug) => localStorage.setItem(KEYS.TENANT_SLUG, slug),
  removeTenantSlug: () => localStorage.removeItem(KEYS.TENANT_SLUG),

  /* User Info */
  getUser: () => {
    try {
      const raw = localStorage.getItem(KEYS.USER);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  setUser:    (user) => localStorage.setItem(KEYS.USER, JSON.stringify(user)),
  removeUser: () => localStorage.removeItem(KEYS.USER),

  /* Clear Everything */
  clearAll: () => {
    Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
  },
};
