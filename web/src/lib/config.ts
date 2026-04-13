// Centralized configuration for the Seentics frontend
// All environment-specific values should be configured here

export const config = {
  // API Configuration
  apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
  apiVersion: 'v1',

  // Frontend Configuration
  frontendUrl: process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000',

  // Default Site Configuration
  defaultSiteId: process.env.NEXT_PUBLIC_DEFAULT_SITE_ID || '',

  // Support & Contact Configuration
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@seentics.com',
  resendFromEmail: process.env.NEXT_PUBLIC_RESEND_FROM_EMAIL || 'noreply@seentics.com',

  // External Services
  lemonSqueezyUrl: 'https://assets.lemonsqueezy.com/lemon.js',

  // Feature Flags
  enableEmailSupport: process.env.NEXT_PUBLIC_ENABLE_EMAIL_SUPPORT !== 'false',
  enableOAuth: process.env.NEXT_PUBLIC_ENABLE_OAUTH !== 'false',

  // Development Configuration
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',

  // Analytics Configuration
  enableAnalytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS !== 'false',
  enableFunnelTracking: process.env.NEXT_PUBLIC_ENABLE_FUNNEL_TRACKING !== 'false',

  // Privacy Configuration
  enablePrivacyFeatures: process.env.NEXT_PUBLIC_ENABLE_PRIVACY_FEATURES !== 'false',

  // Build Information
  version: process.env.NEXT_PUBLIC_VERSION || '1.0.0',
  buildTime: process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString(),
};

// Helper functions
function normalizeApiEndpoint(endpoint: string): string {
  if (endpoint === '') return '';
  return endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
}

/** Resolved /api/v1 base (no trailing slash). */
function resolvedApiBase(fromEnv: string): string {
  const apiBase = fromEnv.replace(/\/$/, '');
  return apiBase.endsWith(`/api/${config.apiVersion}`)
    ? apiBase
    : `${apiBase}/api/${config.apiVersion}`;
}

/**
 * Strip trailing slashes and any `/api/v1` suffix so COLLECT = host + '/api/v1/tracker/collect'.
 * Matches the tracker script's `data-api-host` normalization.
 */
export function normalizeTrackerApiHost(raw: string): string {
  let s = raw.trim().replace(/\/+$/, '');
  while (/\/api\/v1$/i.test(s)) {
    s = s.replace(/\/api\/v1$/i, '');
  }
  return s;
}

export const getApiUrl = (endpoint: string = '') => {
  const ep = normalizeApiEndpoint(endpoint);

  if (typeof window !== 'undefined') {
    // When NEXT_PUBLIC_API_URL is absolute (e.g. http://localhost:8080/api/v1 in Docker),
    // call the gateway directly. Same-origin /api/v1 only works if Next rewrites proxy correctly.
    const publicUrl = (process.env.NEXT_PUBLIC_API_URL || '').trim();
    if (publicUrl.startsWith('http://') || publicUrl.startsWith('https://')) {
      return `${resolvedApiBase(publicUrl)}${ep}`;
    }
    return `/api/${config.apiVersion}${ep}`;
  }

  let apiBase = config.apiBaseUrl.replace(/\/$/, '');
  const base = apiBase.endsWith(`/api/${config.apiVersion}`)
    ? apiBase
    : `${apiBase}/api/${config.apiVersion}`;

  return `${base}${ep}`;
};

/** Absolute gateway base for full-page redirects (OAuth). Matches browser API base when NEXT_PUBLIC_API_URL is set. */
export function getGatewayBaseUrlForRedirect(): string {
  const v = config.apiVersion;
  const base = config.apiBaseUrl.replace(/\/$/, '');
  return base.endsWith(`/api/${v}`) ? base : `${base}/api/${v}`;
}

export const getFullUrl = (path: string = '') => {
  return `${config.frontendUrl}${path}`;
};

export const isLocalhost = () => {
  if (typeof window !== 'undefined') {
    return window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';
  }
  return false;
};

export const getApiHost = () => {
  if (typeof window !== 'undefined') {
    return isLocalhost() ? config.apiBaseUrl : `https://${window.location.hostname}`;
  }
  return config.apiBaseUrl;
};
