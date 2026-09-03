import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { authApi } from '../api/authApi';
import { storage } from '../utils/storage';
import { ROLE_DEFAULT_ROUTE, ROUTES } from '../utils/constants';

const UNLIMITED = -1;

/*
 * Flattens the server's LoginResponse into the session object.
 *
 * The subscription block is taken verbatim from the same entitlement snapshot the server enforces
 * with. Previously this function invented fallbacks — `maxTables ?? 5`, `includesExpenses ?? true`
 * — so a response missing a field left the client believing it had access the API would refuse.
 * A missing subscription is now recorded as missing.
 */
function toUserInfo(data, tenantSlug) {
  const sub = data.subscription ?? null;
  return {
    id:              data.userId,
    username:        data.username,
    fullName:        data.fullName,
    role:            data.role,
    tenantName:      data.tenantName,
    tenantSlug:      data.tenantSlug || tenantSlug,
    logoUrl:         data.logoUrl || null,
    planSelected:    data.planSelected ?? false,
    subscriptionPlan: sub?.planCode ?? null,
    planDisplayName:  sub?.planName ?? null,
    subscriptionStatus: sub?.status ?? null,
    accessLevel:      sub?.accessLevel ?? 'READ_ONLY',
    daysRemaining:    sub?.daysRemaining ?? null,
    perpetual:        sub?.perpetual ?? false,
    inGrace:          sub?.inGrace ?? false,
    periodEnd:        sub?.periodEnd ?? null,
    maxTables:        sub?.maxTables ?? 0,
    maxUsers:         sub?.maxUsers ?? 0,
    maxProducts:      sub?.maxProducts ?? 0,
    features:         sub?.features ?? [],
  };
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]               = useState(() => storage.getUser());
  const [isLoading, setIsLoading]     = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const logoutHandlerRef              = useRef(null);

  /* ── Logout ── */
  const logout = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        const refreshToken = storage.getRefreshToken();
        if (refreshToken) await authApi.logout(refreshToken);
      }
    } catch {
      /* ignore errors on logout */
    } finally {
      storage.clearAll();
      setUser(null);
    }
  }, []);

  /* ── Listen for forced logout events from the API client ── */
  useEffect(() => {
    const handler = () => logout(true);
    logoutHandlerRef.current = handler;
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, [logout]);

  /* ── Initialization: validate stored session ── */
  useEffect(() => {
    const storedUser = storage.getUser();
    const accessToken = storage.getAccessToken();

    if (storedUser && accessToken) {
      setUser(storedUser);
    } else {
      storage.clearAll();
      setUser(null);
    }
    setIsInitialized(true);
  }, []);

  /* ── Login ── */
  const login = useCallback(async (tenantSlug, username, password) => {
    setIsLoading(true);
    try {
      const data = await authApi.login(tenantSlug, username, password);
      storage.setAccessToken(data.token);
      storage.setRefreshToken(data.refreshToken);
      storage.setTenantSlug(tenantSlug);

      const userInfo = toUserInfo(data, tenantSlug);
      storage.setUser(userInfo);
      setUser(userInfo);
      return { success: true, defaultRoute: ROLE_DEFAULT_ROUTE[data.role] };
    } catch (err) {
      return { success: false, message: err.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  /* ── Login with PIN ── */
  const loginPin = useCallback(async (tenantSlug, pin) => {
    setIsLoading(true);
    try {
      const data = await authApi.loginPin(tenantSlug, pin);
      storage.setAccessToken(data.token);
      storage.setRefreshToken(data.refreshToken);
      storage.setTenantSlug(tenantSlug);

      const userInfo = toUserInfo(data, tenantSlug);
      storage.setUser(userInfo);
      setUser(userInfo);
      return { success: true, defaultRoute: ROLE_DEFAULT_ROUTE[data.role] };
    } catch (err) {
      return { success: false, message: err.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateTenantInfo = useCallback((updates) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      storage.setUser(updated);
      return updated;
    });
  }, []);

  /** Accepts a SubscriptionDto from /tenant/plan or a licence activation. */
  const updateTenantPlan = useCallback((subscription) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        subscriptionPlan:   subscription.planCode ?? prev.subscriptionPlan,
        planDisplayName:    subscription.planName ?? prev.planDisplayName,
        subscriptionStatus: subscription.status ?? prev.subscriptionStatus,
        periodEnd:          subscription.currentPeriodEnd ?? null,
        perpetual:          subscription.perpetual ?? false,
        planSelected:       true,
      };
      storage.setUser(updated);
      return updated;
    });
  }, []);

  /** Replaces the session's subscription block from a /tenant/usage payload. */
  const refreshEntitlements = useCallback((usage) => {
    setUser((prev) => {
      if (!prev || !usage) return prev;
      /*
       * Ignore a payload that isn't the current shape. A backend still serving the pre-billing
       * usage response has no `quotas` array, and reading limits off it would resolve every one to
       * zero — which the quota checks read as "nothing allowed" and would lock the UI down against
       * a server that is perfectly happy.
       */
      if (!Array.isArray(usage.quotas)) return prev;
      const limitFor = (type) => usage.quotas.find((q) => q.type === type)?.limit ?? 0;
      const updated = {
        ...prev,
        subscriptionPlan:   usage.planCode ?? prev.subscriptionPlan,
        planDisplayName:    usage.planName ?? prev.planDisplayName,
        subscriptionStatus: usage.status ?? prev.subscriptionStatus,
        accessLevel:        usage.accessLevel ?? prev.accessLevel,
        daysRemaining:      usage.daysRemaining ?? null,
        perpetual:          usage.perpetual ?? false,
        inGrace:            usage.inGrace ?? false,
        periodEnd:          usage.periodEnd ?? null,
        maxTables:          limitFor('TABLES'),
        maxUsers:           limitFor('USERS'),
        maxProducts:        limitFor('PRODUCTS'),
        features:           usage.features?.map((f) => f.code) ?? prev.features,
      };
      storage.setUser(updated);
      return updated;
    });
  }, []);

  const isTrial   = user?.subscriptionStatus === 'TRIALING';
  const inGrace   = user?.inGrace === true;
  /* Read-only or blocked: the server has stopped accepting writes. */
  const isExpired = user ? user.accessLevel !== 'FULL' : false;

  /*
   * Feature checks read the plan's own feature list. The old version hardcoded two features and
   * defaulted `expenses` to true when unknown, so the UI offered a button the API would reject.
   */
  const canAccess = useCallback(
    (feature) => (user?.features ?? []).includes(String(feature).toUpperCase()),
    [user],
  );

  /** null means unlimited — the server's -1 sentinel, not a number to compare against. */
  const quotaRemaining = useCallback((resource, currentCount = 0) => {
    if (!user) return null;
    const limit = {
      tables:   user.maxTables,
      users:    user.maxUsers,
      products: user.maxProducts,
    }[resource];
    if (limit === undefined || limit === UNLIMITED) return null;
    return Math.max(0, limit - currentCount);
  }, [user]);

  /* ── Login Super Admin (Master Platform) ── */
  const loginSuperAdmin = useCallback(async (username, password) => {
    setIsLoading(true);
    try {
      const data = await authApi.loginSuperAdmin(username, password);
      storage.setAccessToken(data.token);
      storage.setRefreshToken(data.refreshToken);
      storage.setTenantSlug('platform');

      const userInfo = {
        ...toUserInfo(data, 'platform'),
        fullName: data.fullName || 'Platform Master',
        role: 'SUPER_ADMIN',
      };
      storage.setUser(userInfo);
      setUser(userInfo);
      return { success: true, defaultRoute: ROUTES.SUPER_ADMIN };
    } catch (err) {
      return { success: false, message: err.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value = {
    user,
    role:            user?.role ?? null,
    isAuthenticated: !!user,
    isLoading,
    isInitialized,
    login,
    loginPin,
    loginSuperAdmin,
    logout,
    updateTenantInfo,
    updateTenantPlan,
    refreshEntitlements,
    hasRole:   (...roles) => roles.includes(user?.role),
    isTrial,
    isExpired,
    inGrace,
    canAccess,
    quotaRemaining
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
