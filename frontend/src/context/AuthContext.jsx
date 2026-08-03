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
        id:       data.userId,
        username: data.username,
        fullName: data.fullName,
        role:     data.role,
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

  const value = {
    user,
    role:            user?.role ?? null,
    isAuthenticated: !!user,
    isLoading,
    isInitialized,
    login,
    logout,
    hasRole:   (...roles) => roles.includes(user?.role),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
