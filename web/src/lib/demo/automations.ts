/**
 * Demo data for automations
 */
import { TEMPLATES } from '@/features/automations/templates';
import { demoDate } from './fixture-utils';
import { DEMO_ROUTING } from './submissions';

/** A template's definition, so a demo popup opens in the builder exactly as the template does. */
const templateDefinition = (id: string): Record<string, unknown> =>
  TEMPLATES.find((t) => t.id === id)!.definition as unknown as Record<string, unknown>;

/**
 * A lead-form template routed to the demo's destinations, so its page shows where submissions go
 * (and the builder's "Send submissions to" control opens with a real selection).
 */
function routedTemplate(id: string, automationId: string): Record<string, unknown> {
  const def = JSON.parse(JSON.stringify(templateDefinition(id))) as { graph?: { nodes?: { action?: { form?: Record<string, unknown> } }[] } };
  for (const node of def.graph?.nodes ?? []) {
    if (node.action?.form) node.action.form.destinations = DEMO_ROUTING[automationId] ?? [];
  }
  return def as Record<string, unknown>;
}

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
      createdAt: demoDate(-30 * 86400000).toISOString(),
      updatedAt: demoDate().toISOString(),
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
      createdAt: demoDate(-20 * 86400000).toISOString(),
      updatedAt: demoDate().toISOString(),
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
      createdAt: demoDate(-14 * 86400000).toISOString(),
      updatedAt: demoDate().toISOString(),
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
      createdAt: demoDate(-45 * 86400000).toISOString(),
      updatedAt: demoDate(-5 * 86400000).toISOString(),
      actions: [
        { actionType: 'email' as const, actionConfig: { subject: 'We miss you!', template: 'retention_recovery' } },
      ],
      stats: { totalExecutions: 843, successCount: 841, failureCount: 2, successRate: 99.7, last30Days: 0 },
    },
    {
      id: 'demo-auto-5',
      websiteId: 'demo',
      userId: 'demo-user',
      name: 'Spin to Win Wheel',
      description: 'Visitors enter their email to spin a prize wheel',
      triggerType: 'time_on_page',
      triggerConfig: { type: 'time_on_page', seconds: 15 },
      isActive: true,
      definition: routedTemplate('spin-to-win', 'demo-auto-5'),
      createdAt: demoDate(-10 * 86400000).toISOString(),
      updatedAt: demoDate().toISOString(),
      actions: [
        { actionType: 'modal' as const, actionConfig: { title: 'Spin to win a prize!', layout: 'spin_wheel' } },
      ],
      stats: { totalExecutions: 1904, successCount: 1904, failureCount: 0, successRate: 100, last30Days: 1120 },
    },
    {
      id: 'demo-auto-6',
      websiteId: 'demo',
      userId: 'demo-user',
      name: 'Exit-Intent Newsletter Signup',
      description: 'Collect an email from visitors about to leave',
      triggerType: 'exit_intent',
      triggerConfig: { type: 'exit_intent' },
      isActive: true,
      definition: routedTemplate('exit-intent-newsletter', 'demo-auto-6'),
      createdAt: demoDate(-8 * 86400000).toISOString(),
      updatedAt: demoDate().toISOString(),
      actions: [
        { actionType: 'modal' as const, actionConfig: { title: 'Before you go…' } },
      ],
      stats: { totalExecutions: 3270, successCount: 3270, failureCount: 0, successRate: 100, last30Days: 1890 },
    },
  ],
  total: 6,
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
