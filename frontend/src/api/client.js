import axios from 'axios';
import { storage } from '../utils/storage';

/* ── Singleton Axios instance ── */
const client = axios.create({
  baseURL: 'http://localhost:8080/api',
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

    /* Don't retry login / refresh endpoints */
    if (
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/refresh')
    ) {
      return Promise.reject(normalizeError(error));
    }

    if (isRefreshing) {
      /* Queue concurrent 401s until refresh completes */
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
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
      const { data } = await axios.post('/api/auth/refresh', { refreshToken });
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

/* ── Normalize errors to a consistent shape ── */
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

    const normalized = new Error(message);
    normalized.status = status;
    normalized.data = data;
    return normalized;
  }
  if (error.request) {
    const normalized = new Error('Network error — could not reach the server.');
    normalized.status = 0;
    return normalized;
  }
  return error;
}

export default client;
