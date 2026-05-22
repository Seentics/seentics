import axios from 'axios';
import { getApiUrl } from './config';

// Read persisted auth state from localStorage (Zustand store)
function getPersistedAuth(): { isAuthenticated: boolean; access_token: string | null; refresh_token: string | null } {
  if (typeof window === 'undefined') return { isAuthenticated: false, access_token: null, refresh_token: null };
  const raw = localStorage.getItem('auth-storage');
  if (!raw) return { isAuthenticated: false, access_token: null, refresh_token: null };
  try {
    const parsed = JSON.parse(raw);
    return {
      isAuthenticated: !!parsed?.state?.isAuthenticated,
      access_token: parsed?.state?.access_token || null,
      refresh_token: parsed?.state?.refresh_token || null,
    };
  } catch {
    return { isAuthenticated: false, access_token: null, refresh_token: null };
  }
}

function hasActiveSession(): boolean {
  return getPersistedAuth().isAuthenticated;
}

// Helper function to logout user and clear auth state
function performLogout() {
  localStorage.removeItem('auth-storage');

  // Clear legacy cookies
  document.cookie = 'auth-storage=; path=/; max-age=0; samesite=lax';

  if (typeof window !== 'undefined') {
    window.location.href = '/signin?expired=true';
  }
}

// Create Axios instance — cookies are sent automatically via withCredentials
const api = axios.create({
  baseURL: getApiUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  timeout: 30000, // 30s timeout
});

// In-memory token — avoids localStorage timing issues after navigation (e.g., signup step 2).
// Set by setApiToken() from useAuthStore actions; falls back to localStorage on cold page load.
let _currentToken: string | null = null;

export function setApiToken(token: string | null) {
  _currentToken = token;
}

// Request interceptor — attach Authorization header from persisted tokens
api.interceptors.request.use((config) => {
  const token = _currentToken ?? getPersistedAuth().access_token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Track if we're currently refreshing to prevent multiple refresh requests
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any = null) => {
  failedQueue.forEach(promise => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve();
    }
  });
  failedQueue = [];
};

// Response interceptor with automatic token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check if this is a demo request - don't redirect on 401 for demo
    const requestUrl = originalRequest?.url || '';
    const isDemoRequest = requestUrl.includes('/demo') ||
      requestUrl.includes('website_id=demo') ||
      requestUrl.includes('websiteId=demo') ||
      requestUrl.match(/\/demo[/?]/) !== null;

    // Demo and secret-verify requests: never redirect on 401
    const isSecretVerify = requestUrl.includes('/verify-secrets');
    if (error.response?.status === 401 && (isDemoRequest || isSecretVerify)) {
      return Promise.reject(error);
    }

    // Handle 401 Unauthorized - attempt token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (!hasActiveSession()) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => api(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { refresh_token } = getPersistedAuth();
        if (!refresh_token) {
          throw new Error('No refresh token available');
        }

        const refreshResponse = await axios.post(
          `${getApiUrl()}/auth/refresh`,
          { refresh_token },
          { withCredentials: true, headers: { 'Content-Type': 'application/json' } }
        );

        // Update persisted tokens with the new ones
        const newTokens = refreshResponse.data;
        setApiToken(newTokens.access_token);
        const raw = localStorage.getItem('auth-storage');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.state) {
            parsed.state.access_token = newTokens.access_token;
            parsed.state.refresh_token = newTokens.refresh_token;
            localStorage.setItem('auth-storage', JSON.stringify(parsed));
          }
        }

        isRefreshing = false;
        processQueue();

        // Retry with new token
        originalRequest.headers.Authorization = `Bearer ${newTokens.access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        processQueue(refreshError);

        console.error('Token refresh failed:', refreshError);
        performLogout();
        return Promise.reject(refreshError);
      }
    }

    // Handle other error messages (API uses `message` or `error`)
    const data = error.response?.data as { message?: string; error?: string } | undefined;
    const apiMsg =
      (typeof data?.message === 'string' && data.message) ||
      (typeof data?.error === 'string' && data.error);
    if (apiMsg) {
      return Promise.reject(new Error(apiMsg));
    }

    return Promise.reject(error);
  }
);

export default api;
