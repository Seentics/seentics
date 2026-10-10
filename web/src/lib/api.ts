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

/**
 * An embedded dashboard (`/embed/…`) has no session: it holds an embed link's token and may
 * only read. While one is set, the dashboard's analytics calls — `/analytics/<name>/<site>` —
 * are sent to the embed API instead, with the token, and nothing else is: no login, no
 * cookies, and a 401 never redirects to sign-in inside someone else's page.
 */
let embedToken: string | null = null;

export function setEmbedToken(token: string | null) {
  embedToken = token;
}

/**
 * The dashboard's read calls, and where the embed API serves each:
 *   /analytics/<name>/<site>        ->  /embed/<site>/analytics/<name>
 *   /replays/<site>[/<rest>]        ->  /embed/<site>/replays[/<rest>]
 *   /heatmaps/<site>/<rest>         ->  /embed/<site>/heatmaps/<rest>
 */
const EMBED_REWRITES: Array<[RegExp, (m: RegExpExecArray) => string]> = [
  [/^\/analytics\/([^/?]+)\/([^/?]+)(\?.*)?$/, m => `/embed/${m[2]}/analytics/${m[1]}${m[3] ?? ''}`],
  [/^\/replays\/([^/?]+)((?:\/[^?]*)?)(\?.*)?$/, m => `/embed/${m[1]}/replays${m[2] ?? ''}${m[3] ?? ''}`],
  [/^\/heatmaps\/([^/?]+)\/([^?]*)(\?.*)?$/, m => `/embed/${m[1]}/heatmaps/${m[2]}${m[3] ?? ''}`],
];

export function toEmbedUrl(url: string): string {
  for (const [re, build] of EMBED_REWRITES) {
    const m = re.exec(url);
    if (m) return build(m);
  }
  return url;
}

// Request interceptor — attach Authorization header from persisted tokens
api.interceptors.request.use((config) => {
  if (embedToken) {
    config.url = toEmbedUrl(config.url ?? '');
    config.withCredentials = false;
    // The link's secret goes only to the embed API, never to any other endpoint.
    if (config.url.startsWith('/embed/')) config.headers['X-Embed-Token'] = embedToken;
    return config;
  }
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

    // Demo and secret-verify requests: never redirect on 401. Nor does anything asked while the
    // demo is on screen: its sidebar asks account endpoints too (entitlements, websites,
    // preferences), and a visitor with an expired session left in the browser was logged out to
    // /signin on clicking "Live demo".
    const isSecretVerify = requestUrl.includes('/verify-secrets');
    const onDemoPage = typeof window !== 'undefined' && /^\/websites\/demo(\/|$)/.test(window.location.pathname);
    if (error.response?.status === 401 && (embedToken || isDemoRequest || isSecretVerify || onDemoPage)) {
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
        // A session started on the auth app (auth.seentics.com) never puts a refresh
        // token in this origin's storage — it lives in the httpOnly cookie the gateway
        // set at sign-in. Requiring one here logged every such user out the first time
        // their access token expired. With no stored token, post an empty body: the
        // gateway reads the refresh cookie (gateway/controllers/auth.ts `refresh`).
        const { refresh_token } = getPersistedAuth();

        const refreshResponse = await axios.post(
          `${getApiUrl()}/auth/refresh`,
          refresh_token ? { refresh_token } : {},
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
