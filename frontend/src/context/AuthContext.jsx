import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { authApi } from '../api/authApi';
import { storage } from '../utils/storage';
import { ROLE_DEFAULT_ROUTE, ROUTES } from '../utils/constants';

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

      const userInfo = {
        id:                 data.userId,
        username:           data.username,
        fullName:           data.fullName,
        role:               data.role,
        tenantName:         data.tenantName,
        tenantSlug:         data.tenantSlug || tenantSlug,
        subscriptionPlan:   data.subscriptionPlan || 'TRIAL',
        planDisplayName:    data.planDisplayName || 'فترة تجريبية',
        trialEndsAt:        data.trialEndsAt,
        subscriptionEndsAt: data.subscriptionEndsAt,
        maxTables:          data.maxTables ?? 5,
        maxUsers:           data.maxUsers ?? 2,
        maxProducts:        data.maxProducts ?? 30,
        includesKds:        data.includesKds ?? false,
        includesExpenses:   data.includesExpenses ?? false,
        logoUrl:            data.logoUrl || null,
        planSelected:       data.planSelected ?? true,
      };
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

      const userInfo = {
        id:                 data.userId,
        username:           data.username,
        fullName:           data.fullName,
        role:               data.role,
        tenantName:         data.tenantName,
        tenantSlug:         data.tenantSlug || tenantSlug,
        subscriptionPlan:   data.subscriptionPlan || 'TRIAL',
        planDisplayName:    data.planDisplayName || 'فترة تجريبية',
        trialEndsAt:        data.trialEndsAt,
        subscriptionEndsAt: data.subscriptionEndsAt,
        maxTables:          data.maxTables ?? 5,
        maxUsers:           data.maxUsers ?? 2,
        maxProducts:        data.maxProducts ?? 30,
        includesKds:        data.includesKds ?? false,
        includesExpenses:   data.includesExpenses ?? false,
        logoUrl:            data.logoUrl || null,
        planSelected:       data.planSelected ?? true,
      };
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

  const updateTenantPlan = useCallback((updatedTenant) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        subscriptionPlan: updatedTenant.subscriptionPlan || prev.subscriptionPlan,
        planDisplayName: updatedTenant.planDisplayName || prev.planDisplayName,
        trialEndsAt: updatedTenant.trialEndsAt !== undefined ? updatedTenant.trialEndsAt : prev.trialEndsAt,
        subscriptionEndsAt: updatedTenant.subscriptionEndsAt !== undefined ? updatedTenant.subscriptionEndsAt : prev.subscriptionEndsAt,
        maxTables: updatedTenant.maxTables ?? prev.maxTables,
        maxUsers: updatedTenant.maxUsers ?? prev.maxUsers,
        maxProducts: updatedTenant.maxProducts ?? prev.maxProducts,
        includesKds: updatedTenant.includesKds ?? prev.includesKds,
        includesExpenses: updatedTenant.includesExpenses ?? prev.includesExpenses,
        planSelected: true,
      };
      storage.setUser(updated);
      return updated;
    });
  }, []);

  const isTrial = user?.subscriptionPlan === 'TRIAL';
  
  const isExpired = (() => {
    if (!user) return false;
    const now = new Date();
    if (isTrial && user.trialEndsAt) {
      return new Date(user.trialEndsAt) < now;
    }
    if (user.subscriptionEndsAt) {
      return new Date(user.subscriptionEndsAt) < now;
    }
    return false;
  })();

  const canAccess = useCallback((feature) => {
    if (!user) return false;
    if (feature === 'kds') return user.includesKds ?? false;
    if (feature === 'expenses') return user.includesExpenses ?? true;
    return true;
  }, [user]);

  const quotaRemaining = useCallback((resource, currentCount = 0) => {
    if (!user) return Infinity;
    if (resource === 'tables') return Math.max(0, (user.maxTables ?? Infinity) - currentCount);
    if (resource === 'users') return Math.max(0, (user.maxUsers ?? Infinity) - currentCount);
    if (resource === 'products') return Math.max(0, (user.maxProducts ?? Infinity) - currentCount);
    return Infinity;
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
        id:                 data.userId,
        username:           data.username,
        fullName:           data.fullName || 'Platform Master',
        role:               'SUPER_ADMIN',
        tenantName:         'Caffio Platform Master',
        tenantSlug:         'platform',
        subscriptionPlan:   'ENTERPRISE',
        planDisplayName:    'Platform Master',
        trialEndsAt:        null,
        subscriptionEndsAt: null,
        maxTables:          9999,
        maxUsers:           9999,
        maxProducts:        9999,
        includesKds:        true,
        includesExpenses:   true,
        logoUrl:            null,
        planSelected:       true,
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
    hasRole:   (...roles) => roles.includes(user?.role),
    isTrial,
    isExpired,
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
