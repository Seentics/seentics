import axios from 'axios';
import { getApiUrl } from './config';

// Check if user has an active session (Zustand store persists user info)
function hasActiveSession(): boolean {
  if (typeof window === 'undefined') return false;
  const raw = localStorage.getItem('auth-storage');
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    return !!parsed?.state?.isAuthenticated;
  } catch {
    return false;
  }
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

    // Handle 401 Unauthorized - attempt token refresh (skip for demo requests)
    if (error.response?.status === 401 && !originalRequest._retry && !isDemoRequest) {
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
        // Refresh via cookie — backend reads refresh_token from httpOnly cookie
        await axios.post(
          `${getApiUrl()}/auth/refresh`,
          {},
          { withCredentials: true, headers: { 'Content-Type': 'application/json' } }
        );

        isRefreshing = false;
        processQueue();

        // Retry the original request — new access_token cookie is set by backend
        return api(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        processQueue(refreshError);

        console.error('Token refresh failed:', refreshError);
        performLogout();
        return Promise.reject(refreshError);
      }
    }

    // Handle other 401 errors - but not for demo or secret verification
    const isSecretVerify = requestUrl.includes('/verify-secrets');

    if (error.response?.status === 401 && !isDemoRequest && !isSecretVerify && hasActiveSession()) {
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
