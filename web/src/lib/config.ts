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
export const getApiUrl = (endpoint: string = '') => {
  if (typeof window !== 'undefined') {
    return `/api/${config.apiVersion}${endpoint}`;
  }

  // Prevent double /api/v1 if config.apiBaseUrl already includes it
  let apiBase = config.apiBaseUrl.replace(/\/$/, ''); // Remove trailing slash
  const base = apiBase.endsWith(`/api/${config.apiVersion}`)
    ? apiBase
    : `${apiBase}/api/${config.apiVersion}`;

  return `${base}${endpoint}`;
};

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
