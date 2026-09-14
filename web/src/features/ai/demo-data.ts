import type { ChatMessage, ConversationSummary } from './types';

/**
 * Deterministic fixtures for the landing page and demos.
 *
 * Fixed ids, figures and labels — no `Math.random()`, no `Date.now()`, no time-relative
 * strings. The marketing shot must render identically every build, and a fixture that
 * drifts makes a rebuild differ from the screenshot that was approved.
 *
 * Invented product data throughout, never a real customer's.
 */
export const AI_DEMO_THREADS: ConversationSummary[] = [
  { id: 'demo-thread-traffic',  title: 'How is traffic doing this week?', messageCount: 4, lastMessageAt: '2026-03-04T16:40:00.000Z' },
  { id: 'demo-thread-checkout', title: 'Why is checkout dropping off?',   messageCount: 6, lastMessageAt: '2026-03-04T11:02:00.000Z' },
  { id: 'demo-thread-errors',   title: 'What broke on mobile yesterday?', messageCount: 3, lastMessageAt: '2026-03-03T09:15:00.000Z' },
];

/**
 * One exchange that shows all three things the assistant does: it answers from real
 * figures, draws them, and drafts a change for a person to approve.
 */
export const AI_DEMO_MESSAGES: ChatMessage[] = [
  {
    id: 'demo-q1',
    role: 'user',
    content: 'Why is checkout dropping off this week?',
  },
  {
    id: 'demo-a1',
    role: 'assistant',
    content:
      'Entries are up 12% but completions are flat — the drop is in the step itself. 31% of ' +
      'sessions that reach /checkout leave before payment, and most hit a JavaScript error first.',
    toolsUsed: ['get_funnel_performance', 'list_error_groups'],
    blocks: [
      {
        kind: 'metrics',
        items: [
          { label: 'Checkout entries', value: 4820, delta: 0.12, format: 'number' },
          { label: 'Completed',        value: 1732, delta: 0.004, format: 'number' },
          { label: 'Drop-off',         value: 0.31, delta: 0.06, format: 'percent' },
        ],
      },
    ],
  },
  {
    id: 'demo-q2',
    role: 'user',
    content: 'Set up a popup offering 10% off when they try to leave checkout',
  },
  {
    id: 'demo-a2',
    role: 'assistant',
    content: "Here's a draft — it won't run until you create and enable it.",
    proposal: {
      resource: 'automation',
      operation: 'create',
      payload: {},
      summary: {
        title: 'Checkout exit offer',
        lines: [
          'Trigger: exit intent',
          'Action: show modal',
          'message: Stay and save 10% on this order',
          'Created inactive — it will not run until you enable it.',
        ],
        hasExternalEffect: false,
      },
    },
  },
];
