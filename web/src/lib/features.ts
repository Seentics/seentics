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

// Usage limits for display based on plan (must match DB: 001_initial_schema.sql)
export const LIMITS = {
  starter: {
    websites: '1',
    events: '5K',
    workflows: '2',
    funnels: '2',
    heatmaps: '3',
    replays: '100',
    teamMembers: '1',
    dataRetention: '30 days',
  },
  growth: {
    websites: '5',
    events: '100K',
    workflows: '10',
    funnels: '10',
    heatmaps: '20',
    replays: '5,000',
    teamMembers: '3',
    dataRetention: '1 year',
  },
  scale: {
    websites: '20',
    events: '1M',
    workflows: '50',
    funnels: '50',
    heatmaps: 'Unlimited',
    replays: '50,000',
    teamMembers: '10',
    dataRetention: '2 years',
  },
  pro_plus: {
    websites: 'Unlimited',
    events: 'Unlimited',
    workflows: 'Unlimited',
    funnels: 'Unlimited',
    heatmaps: 'Unlimited',
    replays: 'Unlimited',
    teamMembers: 'Unlimited',
    dataRetention: 'Custom',
  }
};

// Get current limits based on plan
export const getCurrentLimits = (plan: string = 'starter') => {
  const normalizedPlan = plan.toLowerCase() as keyof typeof LIMITS;
  return LIMITS[normalizedPlan] || LIMITS.starter;
};
