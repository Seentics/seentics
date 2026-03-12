/**
 * Demo data for billing & subscription
 */

export const demoBilling = () => ({
  plan: 'pro',
  status: 'active',
  currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
  monthlyPrice: 29,
  usage: {
    monthlyEvents: { current: 245000, limit: 2000000 },
    websites: { current: 1, limit: 15 },
    funnels: { current: 2, limit: -1 },
    automations: { current: 4, limit: -1 },
    heatmaps: { current: 1, limit: -1 },
    replays: { current: 1240, limit: 50000 },
  },
  features: [
    'Unlimited funnels',
    'Unlimited automations',
    'Session replay (50k/mo)',
    'Heatmaps',
    'Priority support',
    'Custom dashboards',
    'API access',
    'Team collaboration',
  ],
});

export const demoSubscription = () => ({
  id: 'demo-user',
  plan: 'pro',
  status: 'active',
  usage: {
    websites: { current: 1, limit: 15, canCreate: true },
    workflows: { current: 4, limit: -1, canCreate: true },
    funnels: { current: 2, limit: -1, canCreate: true },
    heatmaps: { current: 1, limit: -1, canCreate: true },
    replays: { current: 1240, limit: 50000, canCreate: true },
    monthlyEvents: { current: 245000, limit: 2000000, canCreate: true },
  },
  features: ['all'],
  isActive: true,
});
