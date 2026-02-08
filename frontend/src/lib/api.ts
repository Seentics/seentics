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

    // Handle 401 Unauthorized - attempt token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
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
        // No refresh token available - redirect to login
        isRefreshing = false;
        processQueue(new Error('No refresh token available'));
        
        // Clear auth state and redirect
        localStorage.removeItem('auth-storage');
        if (typeof window !== 'undefined') {
          window.location.href = '/signin?expired=true';
        }
        return Promise.reject(error);
      }

      try {
        // Attempt to refresh the token
        const response = await axios.post(
          `${getApiUrl()}/api/v1/auth/refresh`,
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

        // Refresh failed - clear auth and redirect to login
        localStorage.removeItem('auth-storage');
        if (typeof window !== 'undefined') {
          window.location.href = '/signin?expired=true';
        }
        return Promise.reject(refreshError);
      }
    }

    // Handle other error messages
    if (error.response?.data?.message) {
      return Promise.reject(new Error(error.response.data.message));
    }

    return Promise.reject(error);
  }
);

export default api;
