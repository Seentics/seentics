/**
 * Demo data for automations
 */
import { TEMPLATES } from '@/features/automations/templates';
import { normalizeAutomationFromApi } from '@/features/automations/normalize';
import type { Automation, AutomationStats } from '@/features/automations/types';
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

/** A one-action graph, the shape core stores for the simple automations below. */
const single = (trigger: Record<string, unknown>, action: Record<string, unknown>): Record<string, unknown> => ({
  triggers: [trigger],
  graph: { entry: 'n0', nodes: [{ id: 'n0', kind: 'action', action }], edges: [] },
});

/**
 * The demo's automations, as core returns them — the stored `definition` graph — run through
 * the same normalizer as a real response, so the list, detail page and builder read the demo
 * exactly as they read a live site.
 */
const DEMO_ROWS = (): (Record<string, unknown> & { stats: AutomationStats })[] => [
  {
    id: 'demo-auto-1',
    name: 'Welcome Email Sequence',
    description: 'Send new signups into the 3-part welcome email series',
    is_active: true,
    created_at: demoDate(-30 * 86400000).toISOString(),
    definition: single(
      { type: 'custom_event', name: 'signup_complete' },
      { type: 'webhook', url: 'https://hooks.zapier.com/hooks/catch/demo/welcome', method: 'POST', body: { sequence: 'welcome_series' } },
    ),
    stats: { totalExecutions: 4876, successCount: 4874, failureCount: 2, successRate: 99.9, last30Days: 842 },
  },
  {
    id: 'demo-auto-2',
    name: 'High-Value Lead Alert',
    description: 'Notify sales when a visitor views pricing 3+ times',
    is_active: true,
    created_at: demoDate(-20 * 86400000).toISOString(),
    definition: {
      triggers: [{ type: 'page_view', path: '/pricing', match_type: 'exact' }],
      graph: {
        entry: 'n0',
        nodes: [
          { id: 'n0', kind: 'if', group: { operator: 'AND', rules: [{ fact: 'visitCount', operator: 'greaterThan', value: '2' }] } },
          { id: 'n1', kind: 'action', action: { type: 'webhook', url: 'https://hooks.slack.com/services/demo', method: 'POST', body: { text: 'Hot lead on {{page}}' } } },
          { id: 'n2', kind: 'action', action: { type: 'tag_session', tag: 'pricing-early-visit' } },
        ],
        edges: [{ from: 'n0', to: 'n1', branch: 'true' }, { from: 'n0', to: 'n2', branch: 'false' }],
      },
    },
    stats: { totalExecutions: 18432, successCount: 18432, failureCount: 0, successRate: 100, last30Days: 5210 },
  },
  {
    id: 'demo-auto-3',
    name: 'Exit-Intent Modal',
    description: 'Show a discount modal when a visitor is about to leave',
    is_active: true,
    created_at: demoDate(-14 * 86400000).toISOString(),
    definition: templateDefinition('exit-intent-discount'),
    stats: { totalExecutions: 6210, successCount: 6208, failureCount: 2, successRate: 99.9, last30Days: 2840 },
  },
  {
    id: 'demo-auto-4',
    name: 'Idle Visitor Nudge',
    description: 'Offer help to visitors who go quiet for a minute',
    is_active: false,
    created_at: demoDate(-45 * 86400000).toISOString(),
    updated_at: demoDate(-5 * 86400000).toISOString(),
    definition: single(
      { type: 'inactivity', seconds: 60 },
      { type: 'show_toast', message: 'Still there? Questions are welcome — just reply in chat.', position: 'bottom-right', duration_ms: 6000 },
    ),
    stats: { totalExecutions: 843, successCount: 841, failureCount: 2, successRate: 99.7, last30Days: 0 },
  },
  {
    id: 'demo-auto-5',
    name: 'Spin to Win Wheel',
    description: 'Visitors enter their email to spin a prize wheel',
    is_active: true,
    created_at: demoDate(-10 * 86400000).toISOString(),
    definition: routedTemplate('spin-to-win', 'demo-auto-5'),
    stats: { totalExecutions: 1904, successCount: 1904, failureCount: 0, successRate: 100, last30Days: 1120 },
  },
  {
    id: 'demo-auto-6',
    name: 'Exit-Intent Newsletter Signup',
    description: 'Collect an email from visitors about to leave',
    is_active: true,
    created_at: demoDate(-8 * 86400000).toISOString(),
    definition: routedTemplate('exit-intent-newsletter', 'demo-auto-6'),
    stats: { totalExecutions: 3270, successCount: 3270, failureCount: 0, successRate: 100, last30Days: 1890 },
  },
];

export const demoAutomations = () => {
  const automations: Automation[] = DEMO_ROWS().map((row) =>
    normalizeAutomationFromApi({
      website_id: 'demo',
      user_id: 'demo-user',
      updated_at: demoDate().toISOString(),
      ...row,
    }),
  );
  return { automations, total: automations.length, limit: automations.length, offset: 0 };
};

export const demoAutomationStats = () => ({
  totalExecutions: 30361,
  successCount: 30355,
  failureCount: 6,
  successRate: 99.9,
  last30Days: 8892,
});
