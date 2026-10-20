/**
 * The starter automation catalogue.
 *
 * Three hundred lines of data that happened to live in a route file. Out here it can
 * back the template picker, an onboarding step, or a marketing page without any of them
 * importing a page component.
 */
import type { AutomationDefinition } from '@/components/automations/AutomationBuilder';
import type { AutomationsMessages } from '@/lib/i18n/messages/automations-en';

/** Names and descriptions are `automations.templates[id]`; category labels `automations.categories[category]`. */
export type TemplateCategory = Exclude<keyof AutomationsMessages['categories'], 'all'>;

export interface Template {
  id: keyof AutomationsMessages['templates'];
  category: TemplateCategory;
  categoryColor: string;
  definition: AutomationDefinition;
}

export const TEMPLATES: Template[] = [
  {
    id: 'spin-to-win',
    category: 'lead_capture',
    categoryColor: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300',
    definition: {
      triggers: [{ type: 'time_on_page', seconds: 15 }],
      graph: {
        entry: 'n0',
        nodes: [
          { id: 'n0', kind: 'action', action: {
        type: 'show_modal',
        layout: 'spin_wheel',
        title: 'Spin to win a prize!',
        body: 'Enter your email for one spin. Everyone wins something.',
        wheel: {
          spin_text: 'Spin to win',
          segments: [
            { label: '10% off', weight: 4, coupon_code: 'SPIN10' },
            { label: 'Free shipping', weight: 3, coupon_code: 'SHIPFREE' },
            { label: '20% off', weight: 1, coupon_code: 'SPIN20' },
            { label: 'Try again', weight: 4, coupon_code: '' },
          ],
        },
        form: {
          fields: [],
          submit_text: 'Spin to win',
          success_message: 'Thanks! Check your inbox.',
          consent_text: 'I agree to receive emails.',
          consent_required: true,
        },
      } },
        ],
        edges: [],
      },
      frequency: { maxPerUser: 1 },
    },
  },
  {
    id: 'countdown-sale-bar',
    category: 'conversion',
    categoryColor: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300',
    definition: {
      triggers: [{ type: 'page_view' }],
      graph: {
        entry: 'n0',
        nodes: [
          { id: 'n0', kind: 'action', action: {
        type: 'show_banner',
        message: 'Flash sale: 25% off everything.',
        position: 'top',
        button_text: 'Shop the sale',
        button_url: '/sale',
        background_color: '#b91c1c',
        text_color: '#ffffff',
        countdown: {
          mode: 'evergreen',
          duration_minutes: 60,
          label: 'Ends in',
          expired_text: 'The sale has ended.',
          hide_on_expire: false,
        },
      } },
        ],
        edges: [],
      },
      frequency: { maxPerSession: 1 },
    },
  },
  {
    id: 'multi-step-quiz',
    category: 'lead_capture',
    categoryColor: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300',
    definition: {
      triggers: [{ type: 'scroll_depth', depth: 50 }],
      graph: {
        entry: 'n0',
        nodes: [
          { id: 'n0', kind: 'action', action: {
        type: 'show_modal',
        layout: 'multi_step',
        title: 'Find the right plan',
        steps: [
          { name: 'goal', title: 'What do you want to do?', body: '', options: [
            { label: 'Understand my traffic', value: 'traffic' },
            { label: 'Improve conversions', value: 'conversions' },
            { label: 'Fix errors faster', value: 'errors' },
          ] },
          { name: 'team_size', title: 'How big is your team?', body: '', options: [
            { label: 'Just me', value: 'solo' },
            { label: '2–10 people', value: 'small' },
            { label: 'More than 10', value: 'large' },
          ] },
        ],
        form: {
          fields: [],
          submit_text: 'Show my recommendation',
          success_message: 'Thanks! We will email your recommendation.',
          consent_text: 'I agree to receive emails.',
          consent_required: true,
        },
      } },
        ],
        edges: [],
      },
      frequency: { maxPerUser: 1 },
    },
  },
  {
    id: 'sticky-email-bar',
    category: 'lead_capture',
    categoryColor: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300',
    definition: {
      triggers: [{ type: 'time_on_page', seconds: 10 }],
      graph: {
        entry: 'n0',
        nodes: [
          { id: 'n0', kind: 'action', action: {
        type: 'show_banner',
        message: 'Get our best tips by email.',
        position: 'bottom',
        background_color: '#111827',
        text_color: '#ffffff',
        form: {
          fields: [],
          submit_text: 'Subscribe',
          success_message: 'Thanks, you are subscribed.',
          consent_required: true,
        },
      } },
        ],
        edges: [],
      },
      frequency: { maxPerUser: 1 },
    },
  },
  {
    id: 'teaser-tab-offer',
    category: 'lead_capture',
    categoryColor: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300',
    definition: {
      triggers: [{ type: 'time_on_page', seconds: 5 }],
      graph: {
        entry: 'n0',
        nodes: [
          { id: 'n0', kind: 'action', action: {
        type: 'show_modal',
        title: 'Take 10% off your first order',
        body: 'Join our list and we will send you a code.',
        teaser: { label: 'Get 10% off', position: 'right', reopen: true },
        form: {
          fields: [],
          submit_text: 'Send my code',
          success_message: 'Your code is on its way.',
          consent_text: 'I agree to receive emails.',
          consent_required: true,
        },
        coupon: { code: 'WELCOME10', description: 'Your 10% off code' },
      } },
        ],
        edges: [],
      },
      frequency: { maxPerUser: 1 },
    },
  },
  {
    id: 'coupon-reveal',
    category: 'conversion',
    categoryColor: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300',
    definition: {
      triggers: [{ type: 'exit_intent' }],
      graph: {
        entry: 'n0',
        nodes: [
          { id: 'n0', kind: 'action', action: {
        type: 'show_modal',
        title: 'Leave with a gift',
        body: 'Enter your email to reveal your discount code.',
        form: {
          fields: [],
          submit_text: 'Reveal my code',
          success_message: 'Here is your code:',
          consent_text: 'I agree to receive emails.',
          consent_required: true,
        },
        coupon: { code: 'GIFT15', description: '15% off your order' },
      } },
        ],
        edges: [],
      },
      frequency: { maxPerSession: 1, cooldownDays: 7 },
    },
  },
  {
    id: 'exit-intent-newsletter',
    category: 'lead_capture',
    categoryColor: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300',
    definition: {
      triggers: [{ type: 'exit_intent' }],
      graph: {
        entry: 'n0',
        nodes: [
          { id: 'n0', kind: 'action', action: {
        type: 'show_modal',
        title: 'Before you go…',
        body: 'Get our best tips by email. No spam, unsubscribe any time.',
        form: {
          fields: [{ name: 'name', type: 'text', label: 'First name', placeholder: '', required: false }],
          submit_text: 'Subscribe',
          success_message: "Thanks! You're on the list.",
          consent_text: 'I agree to receive emails.',
          consent_required: true,
        },
      } },
        ],
        edges: [],
      },
      frequency: { maxPerSession: 1, cooldownDays: 7 },
    },
  },
  {
    id: 'scroll-lead-magnet',
    category: 'lead_capture',
    categoryColor: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300',
    definition: {
      triggers: [{ type: 'scroll_depth', depth: 75 }],
      graph: {
        entry: 'n0',
        nodes: [
          { id: 'n0', kind: 'action', action: {
        type: 'show_modal',
        title: 'Enjoying this?',
        body: 'Get the free guide in your inbox.',
        form: {
          fields: [],
          submit_text: 'Send me the guide',
          success_message: 'Check your inbox!',
          consent_required: true,
        },
      } },
        ],
        edges: [],
      },
      frequency: { maxPerUser: 1 },
    },
  },
  {
    id: 'exit-intent-discount',
    category: 'conversion',
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
    category: 'engagement',
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
          // Every branch must be wired before a graph can be saved; a returning visitor
          // is tagged rather than left on an empty branch the builder refuses.
          { id: 'n2', kind: 'action', action: { type: 'tag_session', tag: 'returning-visitor' } },
        ],
        edges: [
          { from: 'n0', to: 'n1', branch: 'true' },
          { from: 'n0', to: 'n2', branch: 'false' },
        ],
      },
      frequency: { maxPerUser: 1 },
    },
  },
  {
    id: 'rage-click-support',
    category: 'support',
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
    category: 'conversion',
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
          // See "Welcome New Visitors": the false branch must be wired to save.
          { id: 'n2', kind: 'action', action: { type: 'tag_session', tag: 'pricing-early-visit' } },
        ],
        edges: [
          { from: 'n0', to: 'n1', branch: 'true' },
          { from: 'n0', to: 'n2', branch: 'false' },
        ],
      },
      frequency: { maxPerSession: 1, cooldownDays: 7 },
    },
  },
  {
    id: 'form-abandon-recovery',
    category: 'recovery',
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
    category: 'engagement',
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
    category: 'upsell',
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
    category: 'support',
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
    category: 'reengagement',
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
    category: 'integration',
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
    category: 'segmentation',
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
    category: 'engagement',
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

export const CATEGORIES: Array<'all' | TemplateCategory> = ['all', 'conversion', 'engagement', 'support', 'recovery', 'upsell', 'reengagement', 'integration', 'segmentation'];
