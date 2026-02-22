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
};

// Check if a specific feature is enabled
export const hasFeature = (feature: string): boolean => {
  return FEATURES[feature] === true;
};

// Usage limits for display based on plan (must match DB: 0002_billing.up.sql)
export const LIMITS = {
  starter: {
    websites: '1',
    events: '10K',
    workflows: '1',
    funnels: '1',
    heatmaps: '3',
    replays: '100',
    recordingRetention: '30 days',
    analyticsRetention: '30 days',
    support: 'Community',
  },
  growth: {
    websites: '3',
    events: '200K',
    workflows: '10',
    funnels: '10',
    heatmaps: 'Unlimited',
    replays: '10,000',
    recordingRetention: '3 months',
    analyticsRetention: '2 years',
    support: 'Email',
  },
  pro: {
    websites: '15',
    events: '2M',
    workflows: 'Unlimited',
    funnels: 'Unlimited',
    heatmaps: 'Unlimited',
    replays: '50,000',
    recordingRetention: '3 months',
    analyticsRetention: '5 years',
    support: 'Priority',
  },
  enterprise: {
    websites: '100',
    events: '15M',
    workflows: 'Unlimited',
    funnels: 'Unlimited',
    heatmaps: 'Unlimited',
    replays: '200,000',
    recordingRetention: '3 months',
    analyticsRetention: '7 years',
    support: 'Dedicated',
    whiteLabel: true,
    clientManagement: true,
  },
};

// Get current limits based on plan
export const getCurrentLimits = (plan: string = 'starter') => {
  const normalizedPlan = plan.toLowerCase() as keyof typeof LIMITS;
  return LIMITS[normalizedPlan] || LIMITS.starter;
};
