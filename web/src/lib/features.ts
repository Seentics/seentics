/**
 * Feature flags and configuration
 * Single unified system with billing and usage tracking
 */

// Enterprise mode: set NEXT_PUBLIC_IS_ENTERPRISE=true to enable billing, pricing, signup, support, team management
// Defaults to false (OSS self-hosted mode)
export const isEnterprise: boolean =
  process.env.NEXT_PUBLIC_IS_ENTERPRISE === 'true';

// Backward compatibility alias
export const isOpenSource: boolean = !isEnterprise;

// Feature configuration - core features always on, enterprise features gated
export const FEATURES: Record<string, boolean> = {
  // Core features - always enabled
  ANALYTICS_DASHBOARD: true,
  EVENT_TRACKING: true,
  BASIC_REPORTS: true,
  PRIVACY_SETTINGS: true,
  WEBSITE_MANAGEMENT: true,
  WORKFLOW_BASIC: true,
  FUNNEL_BASIC: true,
  HEATMAPS: true,
  LAYOUT_SETTINGS: true,

  // Enterprise-only features
  BILLING_PAGE: isEnterprise,
  SUBSCRIPTION_MANAGEMENT: isEnterprise,
  USAGE_LIMITS_UI: isEnterprise,
  TEAM_MANAGEMENT: isEnterprise,
  SUPPORT_CHAT: isEnterprise,
  ADVANCED_INTEGRATIONS: isEnterprise,
  WHITE_LABEL_OPTIONS: isEnterprise,
  STRIPE_INTEGRATION: isEnterprise,
  USAGE_ANALYTICS: isEnterprise,
  API_ACCESS: isEnterprise,
};

// Check if a specific feature is enabled
export const hasFeature = (feature: string): boolean => {
  return FEATURES[feature] === true;
};
