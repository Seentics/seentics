/**
 * Feature flags and configuration
 * Single unified system with billing and usage tracking
 */

// Feature configuration - all features enabled
export const FEATURES = {
  // Core features
  ANALYTICS_DASHBOARD: true,
  EVENT_TRACKING: true,
  BASIC_REPORTS: true,
  PRIVACY_SETTINGS: true,
  WEBSITE_MANAGEMENT: true,
  WORKFLOW_BASIC: true,
  FUNNEL_BASIC: true,
  HEATMAPS: true,

  // Billing and subscription features
  BILLING_PAGE: true,
  SUBSCRIPTION_MANAGEMENT: true,
  USAGE_LIMITS_UI: true,
  TEAM_MANAGEMENT: true,
  SUPPORT_CHAT: true,
  ADVANCED_INTEGRATIONS: true,
  WHITE_LABEL_OPTIONS: true,
  STRIPE_INTEGRATION: true,
  USAGE_ANALYTICS: true,
} as const;

// Check if a specific feature is enabled
export const hasFeature = (feature: keyof typeof FEATURES): boolean => {
  return FEATURES[feature] === true;
};

// Open source mode flag
export const isOpenSource = false;

// Usage limits for display based on plan
export const LIMITS = {
  free: {
    websites: '1',
    events: '5K events/month',
    workflows: '1',
    funnels: '1',
    teamMembers: '1',
    dataRetention: '30 days',
  },
  starter: {
    websites: '1',
    events: '5K',
    workflows: '1',
    funnels: '1',
    teamMembers: '1',
    dataRetention: '30 days',
  },
  growth: {
    websites: '3',
    events: '100K',
    workflows: '10',
    funnels: '10',
    teamMembers: '3',
    dataRetention: '1 year',
  },
  scale: {
    websites: '10',
    events: '500K',
    workflows: 'Unlimited',
    funnels: 'Unlimited',
    teamMembers: '10',
    dataRetention: '3 years',
  },
  pro_plus: {
    websites: '50',
    events: '5M',
    workflows: 'Unlimited',
    funnels: 'Unlimited',
    teamMembers: 'Unlimited',
    dataRetention: 'Custom',
  }
};

// Get current limits based on plan
export const getCurrentLimits = (plan: string = 'starter') => {
  const normalizedPlan = plan.toLowerCase() as keyof typeof LIMITS;
  return LIMITS[normalizedPlan] || LIMITS.starter;
};
