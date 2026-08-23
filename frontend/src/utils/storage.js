/* ── Keys stored in localStorage ── */
const KEYS = {
  ACCESS_TOKEN:   'caffio_access_token',
  REFRESH_TOKEN:  'caffio_refresh_token',
  TENANT_SLUG:    'caffio_tenant_slug',
  USER:           'caffio_user',
};
const LEGACY_KEYS = {
  ACCESS_TOKEN:   'wanas_access_token',
  REFRESH_TOKEN:  'wanas_refresh_token',
  TENANT_SLUG:    'wanas_tenant_slug',
  USER:           'wanas_user',
};

function getItemWithFallback(key, legacyKey) {
  return localStorage.getItem(key) || localStorage.getItem(legacyKey);
}

export const storage = {
  /* Access Token */
  getAccessToken:    () => getItemWithFallback(KEYS.ACCESS_TOKEN, LEGACY_KEYS.ACCESS_TOKEN),
  setAccessToken:    (token) => localStorage.setItem(KEYS.ACCESS_TOKEN, token),
  removeAccessToken: () => {
    localStorage.removeItem(KEYS.ACCESS_TOKEN);
    localStorage.removeItem(LEGACY_KEYS.ACCESS_TOKEN);
  },

  /* Refresh Token */
  getRefreshToken:    () => getItemWithFallback(KEYS.REFRESH_TOKEN, LEGACY_KEYS.REFRESH_TOKEN),
  setRefreshToken:    (token) => localStorage.setItem(KEYS.REFRESH_TOKEN, token),
  removeRefreshToken: () => {
    localStorage.removeItem(KEYS.REFRESH_TOKEN);
    localStorage.removeItem(LEGACY_KEYS.REFRESH_TOKEN);
  },

  /* Tenant Slug */
  getTenantSlug:    () => getItemWithFallback(KEYS.TENANT_SLUG, LEGACY_KEYS.TENANT_SLUG),
  setTenantSlug:    (slug) => localStorage.setItem(KEYS.TENANT_SLUG, slug),
  removeTenantSlug: () => {
    localStorage.removeItem(KEYS.TENANT_SLUG);
    localStorage.removeItem(LEGACY_KEYS.TENANT_SLUG);
  },

  /* User Info */
  getUser: () => {
    try {
      const raw = getItemWithFallback(KEYS.USER, LEGACY_KEYS.USER);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  setUser:    (user) => localStorage.setItem(KEYS.USER, JSON.stringify(user)),
  removeUser: () => {
    localStorage.removeItem(KEYS.USER);
    localStorage.removeItem(LEGACY_KEYS.USER);
  },

  /* Clear Everything */
  clearAll: () => {
    Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
    Object.values(LEGACY_KEYS).forEach((key) => localStorage.removeItem(key));
  },
};
