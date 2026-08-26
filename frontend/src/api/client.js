import axios from 'axios';
import { storage } from '../utils/storage';
import { toFriendlyMessage } from '../utils/errorMessages';

/* ── API base ──
   Single source of truth. The refresh call below used to repeat the full URL literally, so the
   host lived in two places and any change had to be made twice.

   Defaults to a relative path rather than an absolute localhost URL: this app is always served
   from the same origin as its API (the local jar on :8080 for the Electron dev build, or the
   Railway deployment in production), so a relative path resolves correctly either way without a
   build-time env var. Vite's dev server proxies /api -> localhost:8080 (see vite.config.js) so
   this also works unmodified under `npm run dev`. VITE_API_URL is still available to override
   this for a frontend deployed on a different origin than its API (e.g. a standalone Vercel
   deploy pointed at a separately-hosted backend). */
export const API_BASE = import.meta.env.VITE_API_URL || '/api';

/* ── Singleton Axios instance ── */
const client = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

/* ── Request interceptor: attach Bearer token ── */
client.interceptors.request.use(
  (config) => {
    const token = storage.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/* ── Refresh-token state ── */
let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });
  failedQueue = [];
}

/* ── Response interceptor: handle 401 / refresh ── */
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    /* Ignore non-401 errors and already-retried requests */
    if (!error.response || error.response.status !== 401 || originalRequest._retry) {
      return Promise.reject(normalizeError(error));
    }

    /* Don't retry login / refresh / platform endpoints */
    if (
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/refresh') ||
      originalRequest.url?.includes('/platform/tenants')
    ) {
      return Promise.reject(normalizeError(error));
    }

    if (isRefreshing) {
      /* Queue concurrent 401s until refresh completes */
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          /* Mark queued requests as retried too. Without this only the request that *triggered*
             the refresh carried _retry, so if a queued request came back 401 a second time it
             re-entered this whole branch and could bounce between refresh and retry. */
          originalRequest._retry = true;
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return client(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    const refreshToken = storage.getRefreshToken();
    if (!refreshToken) {
      triggerLogout();
      return Promise.reject(normalizeError(error));
    }

    try {
      const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken });
      storage.setAccessToken(data.token);
      storage.setRefreshToken(data.refreshToken);

      client.defaults.headers.common.Authorization = `Bearer ${data.token}`;
      originalRequest.headers.Authorization = `Bearer ${data.token}`;

      processQueue(null, data.token);
      return client(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      triggerLogout();
      return Promise.reject(normalizeError(refreshError));
    } finally {
      isRefreshing = false;
    }
  }
);

/* ── Logout trigger (dispatched as a custom event) ── */
function triggerLogout() {
  storage.clearAll();
  window.dispatchEvent(new CustomEvent('auth:logout'));
}

/* ── Normalize errors to a consistent shape ──
   Every API failure in the app funnels through here, which makes it the one place worth
   translating. `message` comes out in Egyptian Arabic and phrased as a next step, so no caller has
   to know that the backend speaks English; `rawMessage` keeps the original for logs and support. */
function normalizeError(error) {
  if (error.response) {
    const { status, data } = error.response;
    let message =
      data?.message ||
      data?.error ||
      (typeof data === 'string' ? data : null) ||
      `Request failed with status ${status}`;

    // Handle Spring Boot validation errors nicely
    if (data?.errors && Array.isArray(data.errors) && data.errors.length > 0) {
      // Get the first user-friendly validation message or join them
      message = data.errors.map(err => err.defaultMessage || err.code).join('، ');
    }

    const normalized = new Error(toFriendlyMessage(message, status));
    normalized.rawMessage = message;
    normalized.status = status;
    normalized.data = data;
    return normalized;
  }
  if (error.request) {
    const normalized = new Error(toFriendlyMessage('', 0));
    normalized.rawMessage = 'Network error — could not reach the server.';
    normalized.status = 0;
    return normalized;
  }
  return error;
}

export default client;
