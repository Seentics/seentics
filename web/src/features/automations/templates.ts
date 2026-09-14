/**
 * The starter automation catalogue.
 *
 * Three hundred lines of data that happened to live in a route file. Out here it can
 * back the template picker, an onboarding step, or a marketing page without any of them
 * importing a page component.
 */
import type { AutomationDefinition } from '@/components/automations/AutomationBuilder';

export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  categoryColor: string;
  definition: AutomationDefinition;
}

export const TEMPLATES: Template[] = [
  {
    id: 'exit-intent-discount',
    name: 'Exit-Intent Discount Modal',
    description: 'Show a last-chance offer when a visitor is about to leave.',
    category: 'Conversion',
    categoryColor: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300',
    definition: {
      triggers: [{ type: 'exit_intent' }],
      graph: {
        entry: 'n0',
        nodes: [
          { id: 'n0', kind: 'action', action: {
        type: 'show_modal',
        title: 'Wait! Before you go…',
        body: 'Grab 20% off your first order — today only.',
        button_text: 'Claim offer',
        button_url: '/checkout',
      } },
        ],
        edges: [
          
        ],
      },
      frequency: { maxPerSession: 1, cooldownDays: 3 },
    },
  },
  {
    id: 'welcome-new-visitors',
    name: 'Welcome New Visitors',
    description: 'Greet first-time visitors with a friendly toast notification.',
    category: 'Engagement',
    categoryColor: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300',
    definition: {
      triggers: [{ type: 'page_view' }],
      graph: {
        entry: 'n0',
        nodes: [
          { id: 'n0', kind: 'if', group: { operator: 'AND', rules: [{ fact: 'visitCount', operator: 'equals', value: '1' }] } },
          { id: 'n1', kind: 'action', action: {
        type: 'show_toast',
        message: 'Welcome! 👋 Explore our features below.',
        position: 'bottom-right',
        duration_ms: 5000,
      } },
        ],
        edges: [
          { from: 'n0', to: 'n1', branch: 'true' },
        ],
      },
      frequency: { maxPerUser: 1 },
    },
  },
  {
    id: 'rage-click-support',
    name: 'Rage Click → Live Support',
    description: 'Offer help when a visitor clicks the same spot repeatedly out of frustration.',
    category: 'Support',
    categoryColor: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300',
    definition: {
      triggers: [{ type: 'rage_click' }],
      graph: {
        entry: 'n0',
        nodes: [
          { id: 'n0', kind: 'action', action: { type: 'show_toast', message: 'Having trouble? Our support team is here to help.', position: 'bottom-right', duration_ms: 6000 } },
          { id: 'n1', kind: 'action', action: { type: 'webhook', url: '', method: 'POST', body: { text: 'Rage click detected — visitor may need help on {{page}}' } } },
        ],
        edges: [
          { from: 'n0', to: 'n1' },
        ],
      },
      frequency: { maxPerSession: 1 },
    },
  },
  {
    id: 'pricing-page-followup',
    name: 'Pricing Page Follow-up',
    description: 'Catch returning visitors on your pricing page and offer a demo.',
    category: 'Conversion',
    categoryColor: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300',
    definition: {
      triggers: [{ type: 'page_view', path: '/pricing', match_type: 'exact' }],
      graph: {
        entry: 'n0',
        nodes: [
          { id: 'n0', kind: 'if', group: { operator: 'AND', rules: [{ fact: 'visitCount', operator: 'greaterThan', value: '2' }] } },
          { id: 'n1', kind: 'action', action: {
        type: 'show_modal',
        title: 'Need help choosing a plan?',
        body: "You've visited our pricing page a few times. Let's find the right fit — book a free 15-min call.",
        button_text: 'Book a demo',
        button_url: '/demo',
      } },
        ],
        edges: [
          { from: 'n0', to: 'n1', branch: 'true' },
        ],
      },
      frequency: { maxPerSession: 1, cooldownDays: 7 },
    },
  },
  {
    id: 'form-abandon-recovery',
    name: 'Form Abandonment Recovery',
    description: 'Offer help when a visitor starts a form but navigates away.',
    category: 'Recovery',
    categoryColor: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300',
    definition: {
      triggers: [{ type: 'form_abandon' }],
      graph: {
        entry: 'n0',
        nodes: [
          { id: 'n0', kind: 'action', action: {
        type: 'show_toast',
        message: 'Need help filling out the form? Chat with us →',
        position: 'bottom-right',
        duration_ms: 7000,
      } },
        ],
        edges: [
          
        ],
      },
      frequency: { maxPerSession: 1 },
    },
  },
  {
    id: 'scroll-depth-subscribe',
    name: 'Scroll-Depth Subscribe Banner',
    description: 'Prompt engaged readers to subscribe after they scroll 75% of the page.',
    category: 'Engagement',
    categoryColor: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300',
    definition: {
      triggers: [{ type: 'scroll_depth', depth: 75 }],
      graph: {
        entry: 'n0',
        nodes: [
          { id: 'n0', kind: 'action', action: {
        type: 'show_banner',
        message: 'Enjoying the content? Subscribe for weekly insights.',
        position: 'bottom',
        button_text: 'Subscribe',
        button_url: '/newsletter',
      } },
        ],
        edges: [
          
        ],
      },
      frequency: { maxPerSession: 1, cooldownDays: 14 },
    },
  },
  {
    id: 'long-session-upsell',
    name: 'Long Session Upsell',
    description: 'Surface an upsell modal after a visitor has been engaged for 2 minutes.',
    category: 'Upsell',
    categoryColor: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300',
    definition: {
      triggers: [{ type: 'time_on_page', seconds: 120 }],
      graph: {
        entry: 'n0',
        nodes: [
          { id: 'n0', kind: 'action', action: {
        type: 'show_modal',
        title: "You've been exploring for a while!",
        body: "Unlock premium features and save 30% with our annual plan.",
        button_text: 'See plans',
        button_url: '/pricing',
      } },
        ],
        edges: [
          
        ],
      },
      frequency: { maxPerSession: 1, cooldownDays: 7 },
    },
  },
  {
    id: 'js-error-recovery',
    name: 'JS Error Recovery',
    description: 'Apologize and alert your team when a JS error hits a visitor.',
    category: 'Support',
    categoryColor: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300',
    definition: {
      triggers: [{ type: 'js_error' }],
      graph: {
        entry: 'n0',
        nodes: [
          { id: 'n0', kind: 'action', action: { type: 'show_toast', message: 'Something went wrong. Try refreshing the page.', position: 'top-right', duration_ms: 8000 } },
          { id: 'n1', kind: 'action', action: { type: 'webhook', url: '', method: 'POST', body: { text: 'JS error on {{page}} — visitor: {{user.anonymousId}}' } } },
        ],
        edges: [
          { from: 'n0', to: 'n1' },
        ],
      },
      frequency: { maxPerSession: 3 },
    },
  },
  {
    id: 'inactivity-reengage',
    name: 'Inactivity Re-engage',
    description: 'Nudge visitors who have been idle for 60 seconds.',
    category: 'Re-engagement',
    categoryColor: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300',
    definition: {
      triggers: [{ type: 'inactivity', seconds: 60 }],
      graph: {
        entry: 'n0',
        nodes: [
          { id: 'n0', kind: 'action', action: {
        type: 'show_modal',
        title: 'Still there?',
        body: "Here's something you might have missed while you were away.",
        button_text: 'Take me there',
        button_url: '/features',
      } },
        ],
        edges: [
          
        ],
      },
      frequency: { maxPerSession: 1 },
    },
  },
  {
    id: 'cta-click-webhook',
    name: 'CTA Click → Webhook',
    description: 'Fire a webhook to your CRM whenever a visitor clicks the main CTA.',
    category: 'Integration',
    categoryColor: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300',
    definition: {
      triggers: [{ type: 'click', selector: '#cta-button, .cta-primary' }],
      graph: {
        entry: 'n0',
        nodes: [
          { id: 'n0', kind: 'action', action: {
        type: 'webhook',
        url: '',
        method: 'POST',
        body: { event: 'cta_click', page: '{{page}}', user: '{{user.id}}' },
      } },
        ],
        edges: [
          
        ],
      },
      frequency: { maxPerSession: 5 },
    },
  },
  {
    id: 'identify-tag-session',
    name: 'Identify → Tag Session',
    description: 'Automatically tag sessions by user plan when a visitor identifies.',
    category: 'Segmentation',
    categoryColor: 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950 dark:text-pink-300',
    definition: {
      triggers: [{ type: 'identify' }],
      graph: {
        entry: 'n0',
        nodes: [
          { id: 'n0', kind: 'action', action: { type: 'tag_session', tag: '{{user.plan | default:free}}' } },
        ],
        edges: [
          
        ],
      },
      frequency: { maxPerSession: 1 },
    },
  },
  {
    id: 'tab-return-banner',
    name: 'Tab Return Banner',
    description: "Welcome visitors back when they return to the tab after switching away.",
    category: 'Engagement',
    categoryColor: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300',
    definition: {
      triggers: [{ type: 'tab_visible' }],
      graph: {
        entry: 'n0',
        nodes: [
          { id: 'n0', kind: 'action', action: {
        type: 'show_banner',
        message: "Welcome back! Don't miss our latest update.",
        position: 'top',
        button_text: "See what's new",
        button_url: '/changelog',
        duration_ms: 6000,
      } },
        ],
        edges: [
          
        ],
      },
      frequency: { maxPerSession: 1, cooldownDays: 1 },
    },
  },
];

export const CATEGORIES = ['All', 'Conversion', 'Engagement', 'Support', 'Recovery', 'Upsell', 'Re-engagement', 'Integration', 'Segmentation'];
