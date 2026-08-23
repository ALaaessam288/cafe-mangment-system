import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { authApi } from '../api/authApi';
import { storage } from '../utils/storage';
import { ROLE_DEFAULT_ROUTE } from '../utils/constants';

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

  const isTrial = false;
  const isExpired = false;
  const canAccess = useCallback(() => true, []);
  const quotaRemaining = useCallback(() => Infinity, []);

  const value = {
    user,
    role:            user?.role ?? null,
    isAuthenticated: !!user,
    isLoading,
    isInitialized,
    login,
    loginPin,
    logout,
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
