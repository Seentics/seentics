/**
 * Demo data for automations
 */

export const demoAutomations = () => ({
  automations: [
    {
      id: 'demo-auto-1',
      websiteId: 'demo',
      userId: 'demo-user',
      name: 'Welcome Email Sequence',
      description: 'Send a 3-part welcome email series to new signups',
      triggerType: 'custom_event',
      triggerConfig: { eventName: 'signup_complete' },
      isActive: true,
      createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
      actions: [
        { actionType: 'email' as const, actionConfig: { subject: 'Welcome to Seentics!', template: 'welcome_series_1' } },
      ],
      stats: { totalExecutions: 4876, successCount: 4874, failureCount: 2, successRate: 99.9, last30Days: 842 },
    },
    {
      id: 'demo-auto-2',
      websiteId: 'demo',
      userId: 'demo-user',
      name: 'High-Value Lead Alert',
      description: 'Notify sales team when a visitor views pricing 3+ times',
      triggerType: 'custom_event',
      triggerConfig: { eventName: 'pricing_view', count: 3 },
      isActive: true,
      createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
      actions: [
        { actionType: 'webhook' as const, actionConfig: { url: 'https://hooks.slack.com/...', channel: '#growth-alerts' } },
      ],
      stats: { totalExecutions: 18432, successCount: 18432, failureCount: 0, successRate: 100, last30Days: 5210 },
    },
    {
      id: 'demo-auto-3',
      websiteId: 'demo',
      userId: 'demo-user',
      name: 'Exit-Intent Modal',
      description: 'Show discount modal when user is about to leave pricing page',
      triggerType: 'exit_intent',
      triggerConfig: { pages: ['/pricing'] },
      isActive: true,
      createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
      actions: [
        { actionType: 'modal' as const, actionConfig: { title: 'Wait! Get 20% off', template: 'exit_discount' } },
      ],
      stats: { totalExecutions: 6210, successCount: 6208, failureCount: 2, successRate: 99.9, last30Days: 2840 },
    },
    {
      id: 'demo-auto-4',
      websiteId: 'demo',
      userId: 'demo-user',
      name: 'Retention Recovery Email',
      description: 'Re-engage users who haven\'t visited in 7 days',
      triggerType: 'inactivity',
      triggerConfig: { daysInactive: 7 },
      isActive: false,
      createdAt: new Date(Date.now() - 45 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
      actions: [
        { actionType: 'email' as const, actionConfig: { subject: 'We miss you!', template: 'retention_recovery' } },
      ],
      stats: { totalExecutions: 843, successCount: 841, failureCount: 2, successRate: 99.7, last30Days: 0 },
    },
  ],
  total: 4,
  limit: 10,
  offset: 0,
});

export const demoAutomationStats = () => ({
  totalExecutions: 30361,
  successCount: 30355,
  failureCount: 6,
  successRate: 99.9,
  last30Days: 8892,
});
