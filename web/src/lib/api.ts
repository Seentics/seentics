import axios from 'axios';
import { getApiUrl } from './config';

// Helper function to extract tokens from Zustand's persisted state
function getStoredTokens() {
  const raw = localStorage.getItem('auth-storage');
  if (!raw) return { access_token: null, refresh_token: null };

  try {
    const parsed = JSON.parse(raw);
    const state = parsed?.state;
    return {
      access_token: state?.access_token || null,
      refresh_token: state?.refresh_token || null,
    };
  } catch (error) {
    console.error('Failed to parse auth-storage from localStorage:', error);
    return { access_token: null, refresh_token: null };
  }
}

/**
 * Returns true only if Zustand has finished re-hydrating from localStorage.
 * During SSR or the brief window before hydration, this will be false.
 */
function isAuthHydrated(): boolean {
  if (typeof window === 'undefined') return false;
  // If localStorage has a stored session, treat it as hydrated
  return !!localStorage.getItem('auth-storage');
}

// Helper function to logout user and clear auth state
function performLogout() {
  // Clear localStorage
  localStorage.removeItem('auth-storage');

  // Clear the auth-storage cookie that AuthInitializer sets for middleware
  document.cookie = 'auth-storage=; path=/; max-age=0; samesite=lax';

  // Redirect to signin with expired message
  if (typeof window !== 'undefined') {
    window.location.href = '/signin?expired=true';
  }
}

// Create Axios instance
const api = axios.create({
  baseURL: getApiUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor to include access_token
api.interceptors.request.use(
  (config) => {
    const { access_token } = getStoredTokens();
    if (access_token) {
      config.headers.Authorization = `Bearer ${access_token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

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
  (response) => response, // ⚠️ Return full response
  async (error) => {
    const originalRequest = error.config;

    // Check if this is a demo request - don't redirect on 401 for demo
    const requestUrl = originalRequest.url || '';
    const isDemoRequest = requestUrl.includes('/demo') ||
      requestUrl.includes('website_id=demo') ||
      requestUrl.includes('websiteId=demo') ||
      requestUrl.match(/\/demo[/?]/) !== null; // Match /demo at end or with query/path

    // Handle 401 Unauthorized - attempt token refresh (skip for demo requests)
    if (error.response?.status === 401 && !originalRequest._retry && !isDemoRequest) {
      // Don't logout if auth hasn't loaded yet (prevents redirect loops on initial page load)
      if (!isAuthHydrated()) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue this request while refresh is in progress
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            const { access_token } = getStoredTokens();
            originalRequest.headers.Authorization = `Bearer ${access_token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const { refresh_token } = getStoredTokens();

      if (!refresh_token) {
        // No refresh token available - logout and redirect
        isRefreshing = false;
        processQueue(new Error('No refresh token available'));
        performLogout();
        return Promise.reject(error);
      }

      try {
        // Attempt to refresh the token
        const response = await axios.post(
          `${getApiUrl()}/auth/refresh`,
          { refresh_token },
          { headers: { 'Content-Type': 'application/json' } }
        );

        const { access_token: newAccessToken, refresh_token: newRefreshToken } = response.data;

        // Update stored tokens
        const authStorage = localStorage.getItem('auth-storage');
        if (authStorage) {
          const parsed = JSON.parse(authStorage);
          parsed.state.access_token = newAccessToken;
          if (newRefreshToken) {
            parsed.state.refresh_token = newRefreshToken;
          }
          localStorage.setItem('auth-storage', JSON.stringify(parsed));
        }

        // Update the original request with new token
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        isRefreshing = false;
        processQueue();

        // Retry the original request with new token
        return api(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        processQueue(refreshError);

        // Refresh failed - logout user and redirect
        console.error('Token refresh failed:', refreshError);
        performLogout();
        return Promise.reject(refreshError);
      }
    }

    // Handle other 401 errors (invalid token, etc.) - but not for demo requests
    // Only perform logout if auth is actually hydrated (avoid loops on initial page load)
    if (error.response?.status === 401 && !isDemoRequest && isAuthHydrated()) {
      console.error('Unauthorized access - logging out user');
      performLogout();
      return Promise.reject(error);
    }

    // For demo requests with 401, just reject without redirecting
    if (error.response?.status === 401 && isDemoRequest) {
      return Promise.reject(error);
    }

    // Handle other error messages
    if (error.response?.data?.message) {
      return Promise.reject(new Error(error.response.data.message));
    }

    return Promise.reject(error);
  }
);

export default api;
