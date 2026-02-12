import type { Edge, Node } from 'reactflow';
// Custom node types - defined inline until component is implemented
export type CustomNodeData = any;

export type WorkflowTemplateDifficulty = 'Beginner' | 'Intermediate' | 'Advanced';

export type WorkflowTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: WorkflowTemplateDifficulty;
  useCount: number;
  rating: number; // 0-5
  tags: string[];
  iconName: string; // lucide-react icon name
  nodes: Node<CustomNodeData>[];
  edges: Edge[];
};

const C1 = 'hsl(var(--chart-1))'; // Trigger color
const C2 = 'hsl(var(--chart-2))'; // Condition color
const C4 = 'hsl(var(--chart-4))'; // Action color
const C3 = 'hsl(var(--chart-3))';
const C5 = 'hsl(var(--chart-5))';

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'lead-capture',
    name: 'Lead Capture Workflow',
    description: 'Capture emails with exit-intent popup, gated by frequency cap and track conversions.',
    category: 'Lead Generation',
    difficulty: 'Beginner',
    useCount: 1247,
    rating: 4.8,
    tags: ['lead capture', 'popup', 'email', 'frequency cap'],
    iconName: 'Users',
    nodes: [
      {
        id: 't1',
        type: 'custom',
        position: { x: 200, y: 50 },
        data: { iconName: 'MousePointer', title: 'Exit Intent', type: 'Trigger', color: C1, settings: {} },
      },
      {
        id: 'c1',
        type: 'custom',
        position: { x: 200, y: 180 },
        data: { iconName: 'AlarmClock', title: 'Frequency Cap', type: 'Condition', color: C2, settings: { cooldownSeconds: 86400 } },
      },
      {
        id: 'a1',
        type: 'custom',
        position: { x: 200, y: 310 },
        data: { iconName: 'MessageSquare', title: 'Show Modal', type: 'Action', color: C4, settings: { modalTitle: 'Stay in the loop', modalContent: 'Subscribe for product updates and offers.' } },
      },
      {
        id: 'a2',
        type: 'custom',
        position: { x: 200, y: 440 },
        data: { iconName: 'BarChart2', title: 'Track Event', type: 'Action', color: C4, settings: { eventName: 'lead_capture_modal_shown' } },
      },
    ],
    edges: [
      { id: 'e-t1-c1', source: 't1', target: 'c1', animated: true },
      { id: 'e-c1-a1', source: 'c1', target: 'a1', animated: true },
      { id: 'e-a1-a2', source: 'a1', target: 'a2', animated: true },
    ],
  },
  {
    id: 'abandoned-cart',
    name: 'Abandoned Cart Recovery',
    description: 'Detect checkout page visits and send a reminder email (limited to once per hour); also tag the visitor.',
    category: 'E-commerce',
    difficulty: 'Intermediate',
    useCount: 892,
    rating: 4.6,
    tags: ['e-commerce', 'cart recovery', 'email', 'tags'],
    iconName: 'ShoppingCart',
    nodes: [
      { id: 't1', type: 'custom', position: { x: 200, y: 50 }, data: { iconName: 'Eye', title: 'Page View', type: 'Trigger', color: C1, settings: { url: '/checkout', urlMatchType: 'contains' as any } } },
      { id: 'c1', type: 'custom', position: { x: 200, y: 180 }, data: { iconName: 'AlarmClock', title: 'Frequency Cap', type: 'Condition', color: C2, settings: { cooldownSeconds: 3600 } } },
      { id: 'a1', type: 'custom', position: { x: 200, y: 310 }, data: { iconName: 'Send', title: 'Send Email', type: 'Action', color: C4, isServerAction: true, settings: { emailSubject: 'Complete your purchase', emailBody: 'You left items in your cart. {{cartId}}' } } },
      { id: 'a2', type: 'custom', position: { x: 200, y: 440 }, data: { iconName: 'Tags', title: 'Add/Remove Tag', type: 'Action', color: C4, isServerAction: true, settings: { tagAction: 'add', tagName: 'abandoned-cart' } } },
    ],
    edges: [
      { id: 'e1', source: 't1', target: 'c1', animated: true },
      { id: 'e2', source: 'c1', target: 'a1', animated: true },
      { id: 'e3', source: 'a1', target: 'a2', animated: true },
    ],
  },
  {
    id: 'welcome-sequence',
    name: 'Welcome Email Sequence',
    description: 'Trigger on signup event, then send a timed welcome sequence.',
    category: 'Email Marketing',
    difficulty: 'Beginner',
    useCount: 2156,
    rating: 4.9,
    tags: ['welcome', 'email sequence', 'onboarding'],
    iconName: 'Mail',
    nodes: [
      { id: 't1', type: 'custom', position: { x: 200, y: 50 }, data: { iconName: 'Zap', title: 'Custom Event', type: 'Trigger', color: C1, settings: { customEventName: 'user_signup' } } },
      { id: 'a1', type: 'custom', position: { x: 200, y: 180 }, data: { iconName: 'Send', title: 'Send Email', type: 'Action', color: C4, isServerAction: true, settings: { emailSubject: 'Welcome!', emailBody: 'Thanks for joining us.' } } },
      { id: 'w1', type: 'custom', position: { x: 200, y: 310 }, data: { iconName: 'Hourglass', title: 'Wait', type: 'Action', color: C4, settings: { waitSeconds: 86400 } } },
      { id: 'a2', type: 'custom', position: { x: 200, y: 440 }, data: { iconName: 'Send', title: 'Send Email', type: 'Action', color: C4, isServerAction: true, settings: { emailSubject: 'Getting Started', emailBody: 'Here are some tips to get started.' } } },
    ],
    edges: [
      { id: 'e1', source: 't1', target: 'a1', animated: true },
      { id: 'e2', source: 'a1', target: 'w1', animated: true },
      { id: 'e3', source: 'w1', target: 'a2', animated: true },
    ],
  },
  {
    id: 'customer-support',
    name: 'Customer Support Bot',
    description: 'When on support pages, show a helpful modal and track engagement.',
    category: 'Support',
    difficulty: 'Advanced',
    useCount: 543,
    rating: 4.4,
    tags: ['support', 'chatbot', 'automation'],
    iconName: 'MessageSquare',
    nodes: [
      { id: 't1', type: 'custom', position: { x: 200, y: 50 }, data: { iconName: 'Eye', title: 'Page View', type: 'Trigger', color: C1, settings: { url: '/support', urlMatchType: 'contains' as any } } },
      { id: 'c1', type: 'custom', position: { x: 100, y: 180 }, data: { iconName: 'Smartphone', title: 'Device Type', type: 'Condition', color: C2, settings: { deviceType: 'Desktop' as any } } },
      { id: 'c2', type: 'custom', position: { x: 300, y: 180 }, data: { iconName: 'CalendarClock', title: 'Time Window', type: 'Condition', color: C2, settings: { startHour: 9, endHour: 18 } } },
      { id: 'a1', type: 'custom', position: { x: 200, y: 310 }, data: { iconName: 'MessageSquare', title: 'Show Modal', type: 'Action', color: C3, settings: { modalTitle: 'Need help?', modalContent: 'Chat with our support team.' } } },
      { id: 'a2', type: 'custom', position: { x: 200, y: 440 }, data: { iconName: 'BarChart2', title: 'Track Event', type: 'Action', color: C4, settings: { eventName: 'support_modal_shown' } } },
    ],
    edges: [
      { id: 'e1', source: 't1', target: 'c1', animated: true },
      { id: 'e2', source: 't1', target: 'c2', animated: true },
      { id: 'e3', source: 'c1', target: 'a1', animated: true },
      { id: 'e4', source: 'c2', target: 'a1', animated: true },
      { id: 'e5', source: 'a1', target: 'a2', animated: true },
    ],
  },
  {
    id: 'product-launch',
    name: 'Product Launch Campaign',
    description: 'Announce launches with a banner then follow up by email.',
    category: 'Marketing',
    difficulty: 'Intermediate',
    useCount: 678,
    rating: 4.7,
    tags: ['launch', 'campaign', 'marketing'],
    iconName: 'TrendingUp',
    nodes: [
      { id: 't1', type: 'custom', position: { x: 200, y: 50 }, data: { iconName: 'Eye', title: 'Page View', type: 'Trigger', color: C1, settings: { url: '/', urlMatchType: 'exact' as any } } },
      { id: 'a1', type: 'custom', position: { x: 200, y: 180 }, data: { iconName: 'AlertTriangle', title: 'Show Banner', type: 'Action', color: C5, settings: { bannerPosition: 'top', bannerContent: 'New Product 🚀 Try it today!' } } },
      { id: 'a2', type: 'custom', position: { x: 200, y: 310 }, data: { iconName: 'Send', title: 'Send Email', type: 'Action', color: C4, isServerAction: true, settings: { emailSubject: 'You\'re on the launch list!', emailBody: 'We\'ll keep you posted.' } } },
    ],
    edges: [
      { id: 'e1', source: 't1', target: 'a1', animated: true },
      { id: 'e2', source: 'a1', target: 'a2', animated: true },
    ],
  },
  {
    id: 're-engagement',
    name: 'Customer Re‑engagement',
    description: 'Target returning visitors with personalized offers during business hours.',
    category: 'Retention',
    difficulty: 'Intermediate',
    useCount: 445,
    rating: 4.5,
    tags: ['retention', 're-engagement', 'offers'],
    iconName: 'Users',
    nodes: [
      { id: 't1', type: 'custom', position: { x: 200, y: 50 }, data: { iconName: 'Eye', title: 'Page View', type: 'Trigger', color: C1, settings: {} } },
      { id: 'c1', type: 'custom', position: { x: 100, y: 180 }, data: { iconName: 'UserPlus', title: 'New vs Returning', type: 'Condition', color: C2, settings: { visitorType: 'returning' as any } } },
      { id: 'c2', type: 'custom', position: { x: 300, y: 180 }, data: { iconName: 'CalendarClock', title: 'Time Window', type: 'Condition', color: C2, settings: { startHour: 8, endHour: 20 } } },
      { id: 'a1', type: 'custom', position: { x: 200, y: 310 }, data: { iconName: 'Send', title: 'Send Email', type: 'Action', color: C4, isServerAction: true, settings: { emailSubject: 'We miss you!', emailBody: 'Here is a special offer just for you.' } } },
    ],
    edges: [
      { id: 'e1', source: 't1', target: 'c1', animated: true },
      { id: 'e2', source: 't1', target: 'c2', animated: true },
      { id: 'e3', source: 'c1', target: 'a1', animated: true },
      { id: 'e4', source: 'c2', target: 'a1', animated: true },
    ],
  },
  {
    id: 'ab-split-offer',
    name: 'A/B Offer Test',
    description: 'Split visitors into A/B and show different CTAs; track which performs better.',
    category: 'Optimization',
    difficulty: 'Advanced',
    useCount: 231,
    rating: 4.3,
    tags: ['A/B test', 'optimization', 'banner'],
    iconName: 'Split',
    nodes: [
      { id: 't1', type: 'custom', position: { x: 200, y: 50 }, data: { iconName: 'Eye', title: 'Page View', type: 'Trigger', color: C1, settings: {} } },
      { id: 'c1', type: 'custom', position: { x: 200, y: 180 }, data: { iconName: 'Split', title: 'A/B Split', type: 'Condition', color: C2, settings: { variantAPercent: 50 } } },
      { id: 'a1', type: 'custom', position: { x: 100, y: 310 }, data: { iconName: 'AlertTriangle', title: 'Show Banner', type: 'Action', color: C4, settings: { bannerPosition: 'top', bannerContent: 'Offer A: 10% off' } } },
      { id: 'a2', type: 'custom', position: { x: 300, y: 310 }, data: { iconName: 'AlertTriangle', title: 'Show Banner', type: 'Action', color: C4, settings: { bannerPosition: 'top', bannerContent: 'Offer B: Free Shipping' } } },
      { id: 'a3', type: 'custom', position: { x: 100, y: 440 }, data: { iconName: 'BarChart2', title: 'Track Event', type: 'Action', color: C4, settings: { eventName: 'offer_a_shown' } } },
      { id: 'a4', type: 'custom', position: { x: 300, y: 440 }, data: { iconName: 'BarChart2', title: 'Track Event', type: 'Action', color: C4, settings: { eventName: 'offer_b_shown' } } },
    ],
    edges: [
      { id: 'e1', source: 't1', target: 'c1', animated: true },
      { id: 'e2', source: 'c1', target: 'a1', animated: true, data: { label: 'A' } },
      { id: 'e3', source: 'c1', target: 'a2', animated: true, data: { label: 'B' } },
      { id: 'e4', source: 'a1', target: 'a3', animated: true },
      { id: 'e5', source: 'a2', target: 'a4', animated: true },
    ],
  },
  {
    id: 'gdpr-consent',
    name: 'GDPR Consent Banner',
    description: 'Show a consent banner once per 7 days and track consent views.',
    category: 'Compliance',
    difficulty: 'Beginner',
    useCount: 1575,
    rating: 4.6,
    tags: ['consent', 'privacy', 'banner'],
    iconName: 'ShieldCheck',
    nodes: [
      { id: 't1', type: 'custom', position: { x: 200, y: 50 }, data: { iconName: 'Eye', title: 'Page View', type: 'Trigger', color: C1, settings: {} } },
      { id: 'c1', type: 'custom', position: { x: 200, y: 180 }, data: { iconName: 'AlarmClock', title: 'Frequency Cap', type: 'Condition', color: C2, settings: { cooldownSeconds: 604800 } } },
      { id: 'a1', type: 'custom', position: { x: 200, y: 310 }, data: { iconName: 'AlertTriangle', title: 'Show Banner', type: 'Action', color: C4, settings: { bannerPosition: 'bottom', bannerContent: 'We use cookies to improve your experience.' } } },
      { id: 'a2', type: 'custom', position: { x: 200, y: 440 }, data: { iconName: 'BarChart2', title: 'Track Event', type: 'Action', color: C4, settings: { eventName: 'gdpr_banner_shown' } } },
    ],
    edges: [
      { id: 'e1', source: 't1', target: 'c1', animated: true },
      { id: 'e2', source: 'c1', target: 'a1', animated: true },
      { id: 'e3', source: 'a1', target: 'a2', animated: true },
    ],
  },
  {
    id: 'newsletter-growth',
    name: 'Newsletter Growth',
    description: 'Prompt subscription after meaningful engagement, and track conversions.',
    category: 'Growth',
    difficulty: 'Beginner',
    useCount: 1840,
    rating: 4.7,
    tags: ['newsletter', 'modal', 'engagement'],
    iconName: 'Newspaper',
    nodes: [
      { id: 't1', type: 'custom', position: { x: 200, y: 50 }, data: { iconName: 'ArrowDownToLine', title: 'Scroll Depth', type: 'Trigger', color: C1, settings: { scrollDepth: 60 } } },
      { id: 'a1', type: 'custom', position: { x: 200, y: 180 }, data: { iconName: 'MessageSquare', title: 'Show Modal', type: 'Action', color: C4, settings: { modalTitle: 'Join our newsletter', modalContent: 'Get product updates and guides.' } } },
      { id: 'a2', type: 'custom', position: { x: 200, y: 310 }, data: { iconName: 'BarChart2', title: 'Track Event', type: 'Action', color: C4, settings: { eventName: 'newsletter_modal_shown' } } },
    ],
    edges: [
      { id: 'e1', source: 't1', target: 'a1', animated: true },
      { id: 'e2', source: 'a1', target: 'a2', animated: true },
    ],
  },
  {
    id: 'high-intent-cta',
    name: 'High-Intent CTA',
    description: 'Redirect engaged pricing viewers to signup when they click the main CTA.',
    category: 'Conversion',
    difficulty: 'Beginner',
    useCount: 720,
    rating: 4.4,
    tags: ['cta', 'redirect', 'pricing'],
    iconName: 'Pointer',
    nodes: [
      { id: 't1', type: 'custom', position: { x: 200, y: 50 }, data: { iconName: 'CheckSquare', title: 'Element Click', type: 'Trigger', color: C1, settings: { selector: '#pricing-cta' } } },
      { id: 'a1', type: 'custom', position: { x: 200, y: 180 }, data: { iconName: 'Link2', title: 'Redirect URL', type: 'Action', color: C4, settings: { redirectUrl: '/login' } } },
    ],
    edges: [ { id: 'e1', source: 't1', target: 'a1', animated: true } ],
  },
  {
    id: 'utm-campaign-modal',
    name: 'UTM Campaign Modal',
    description: 'Show a targeted modal when a UTM source is present in the URL.',
    category: 'Attribution',
    difficulty: 'Intermediate',
    useCount: 960,
    rating: 4.5,
    tags: ['utm', 'campaign', 'modal'],
    iconName: 'ListFilter',
    nodes: [
      { id: 't1', type: 'custom', position: { x: 200, y: 50 }, data: { iconName: 'Eye', title: 'Page View', type: 'Trigger', color: C1, settings: {} } },
      { id: 'c1', type: 'custom', position: { x: 200, y: 180 }, data: { iconName: 'ListFilter', title: 'Query Param', type: 'Condition', color: C2, settings: { queryParam: 'utm_source', queryMatchType: 'exists' as any } } },
      { id: 'a1', type: 'custom', position: { x: 200, y: 310 }, data: { iconName: 'MessageSquare', title: 'Show Modal', type: 'Action', color: C4, settings: { modalTitle: 'Special Offer', modalContent: 'Welcome campaign visitor! Enjoy exclusive content.' } } },
    ],
    edges: [
      { id: 'e1', source: 't1', target: 'c1', animated: true },
      { id: 'e2', source: 'c1', target: 'a1', animated: true },
    ],
  },
  {
    id: 'nps-survey',
    name: 'NPS Survey Prompt',
    description: 'Ask for feedback after 45s on page using an inline insert section.',
    category: 'Feedback',
    difficulty: 'Intermediate',
    useCount: 510,
    rating: 4.2,
    tags: ['survey', 'feedback', 'insert'],
    iconName: 'SmilePlus',
    nodes: [
      { id: 't1', type: 'custom', position: { x: 200, y: 50 }, data: { iconName: 'Clock', title: 'Time Spent', type: 'Trigger', color: C1, settings: { seconds: 45 } } },
      { id: 'a1', type: 'custom', position: { x: 200, y: 180 }, data: { iconName: 'LayoutTemplate', title: 'Insert Section', type: 'Action', color: C4, settings: { selector: 'body', insertPosition: 'append' as any, customHtml: '<div style="padding:12px;border:1px solid #e5e7eb;border-radius:8px">How likely are you to recommend us? (0-10)</div>' } } },
    ],
    edges: [ { id: 'e1', source: 't1', target: 'a1', animated: true } ],
  },
  {
    id: 'crm-webhook-sync',
    name: 'CRM Webhook Sync',
    description: 'On qualified lead event, sync to your CRM via webhook and tag the visitor.',
    category: 'Integrations',
    difficulty: 'Intermediate',
    useCount: 305,
    rating: 4.1,
    tags: ['webhook', 'crm', 'tags'],
    iconName: 'Webhook',
    nodes: [
      { id: 't1', type: 'custom', position: { x: 200, y: 50 }, data: { iconName: 'Zap', title: 'Custom Event', type: 'Trigger', color: C1, settings: { customEventName: 'qualified_lead' } } },
      { id: 'a1', type: 'custom', position: { x: 200, y: 180 }, data: { iconName: 'Webhook', title: 'Webhook', type: 'Action', color: C4, isServerAction: true, settings: { webhookUrl: 'https://hooks.example.com/crm' } } },
      { id: 'a2', type: 'custom', position: { x: 200, y: 310 }, data: { iconName: 'Tags', title: 'Add/Remove Tag', type: 'Action', color: C4, isServerAction: true, settings: { tagAction: 'add', tagName: 'crm-synced' } } },
    ],
    edges: [ { id: 'e1', source: 't1', target: 'a1', animated: true }, { id: 'e2', source: 'a1', target: 'a2', animated: true } ],
  },
  {
    id: 'lead-qualification',
    name: 'Lead Qualification',
    description: 'Automatically score leads based on engagement behavior and send qualified prospects to your CRM.',
    category: 'Sales & Marketing',
    difficulty: 'Intermediate',
    useCount: 127,
    rating: 4.8,
    tags: ['Lead Scoring', 'Sales', 'Engagement', 'Automation'],
    iconName: 'Target',
    nodes: [
      {
        id: '1',
        type: 'custom',
        position: { x: 200, y: 50 },
        data: {
          title: 'Page View',
          type: 'Trigger',
          iconName: 'Eye',
          color: C1,
          settings: {
            url: '/pricing',
            urlMatchType: 'contains'
          }
        }
      },
      {
        id: '2',
        type: 'custom',
        position: { x: 100, y: 180 },
        data: {
          title: 'Time on Page',
          type: 'Condition',
          iconName: 'Clock',
          color: C2,
          settings: {
            seconds: 30
          }
        }
      },
      {
        id: '3',
        type: 'custom',
        position: { x: 300, y: 180 },
        data: {
          title: 'Scroll Depth',
          type: 'Condition',
          iconName: 'ArrowDownToLine',
          color: C2,
          settings: {
            scrollDepth: 50
          }
        }
      },
      {
        id: '4',
        type: 'custom',
        position: { x: 200, y: 310 },
        data: {
          title: 'Track Event',
          type: 'Action',
          iconName: 'BarChart2',
          color: C4,
          settings: {
            eventName: 'lead_scored'
          }
        }
      },
      {
        id: '5',
        type: 'custom',
        position: { x: 100, y: 440 },
        data: {
          title: 'Webhook',
          type: 'Action',
          iconName: 'Webhook',
          color: C4,
          isServerAction: true,
          settings: {
            webhookUrl: 'https://hooks.example.com/crm'
          }
        }
      },
      {
        id: '6',
        type: 'custom',
        position: { x: 300, y: 440 },
        data: {
          title: 'Send Email',
          type: 'Action',
          iconName: 'Send',
          color: C4,
          isServerAction: true,
          settings: {
            emailSendType: 'custom',
            emailTo: 'sales@company.com',
            emailSubject: 'New Qualified Lead',
            emailBody: 'A new qualified lead has been identified.'
          }
        }
      }
    ],
    edges: [
      { id: 'e1-2', source: '1', target: '2', type: 'smoothstep' },
      { id: 'e1-3', source: '1', target: '3', type: 'smoothstep' },
      { id: 'e2-4', source: '2', target: '4', type: 'smoothstep' },
      { id: 'e3-4', source: '3', target: '4', type: 'smoothstep' },
      { id: 'e4-5', source: '4', target: '5', type: 'smoothstep' },
      { id: 'e4-6', source: '4', target: '6', type: 'smoothstep' }
    ]
  },
  {
    id: 'advanced-funnel-optimization',
    name: 'Advanced Funnel Optimization',
    description: 'Multi-step funnel with conditional branching based on user behavior and device type.',
    category: 'Optimization',
    difficulty: 'Advanced',
    useCount: 89,
    rating: 4.9,
    tags: ['funnel', 'optimization', 'branching', 'advanced'],
    iconName: 'GitBranch',
    nodes: [
      {
        id: 't1',
        type: 'custom',
        position: { x: 200, y: 50 },
        data: {
          title: 'Page View',
          type: 'Trigger',
          iconName: 'Eye',
          color: C1,
          settings: {
            url: '/product',
            urlMatchType: 'contains'
          }
        }
      },
      {
        id: 'c1',
        type: 'custom',
        position: { x: 200, y: 180 },
        data: {
          title: 'Device Type',
          type: 'Condition',
          iconName: 'Smartphone',
          color: C2,
          settings: {
            deviceType: 'Mobile'
          }
        }
      },
      {
        id: 'a1',
        type: 'custom',
        position: { x: 100, y: 310 },
        data: {
          title: 'Show Modal',
          type: 'Action',
          iconName: 'MessageSquare',
          color: C4,
          settings: {
            modalTitle: 'Mobile Special Offer',
            modalContent: 'Get 15% off on mobile!'
          }
        }
      },
      {
        id: 'a2',
        type: 'custom',
        position: { x: 300, y: 310 },
        data: {
          title: 'Show Banner',
          type: 'Action',
          iconName: 'AlertTriangle',
          color: C4,
          settings: {
            bannerPosition: 'top',
            bannerContent: 'Desktop users: Free shipping on orders over $50'
          }
        }
      },
      {
        id: 'c2',
        type: 'custom',
        position: { x: 200, y: 440 },
        data: {
          title: 'Time Window',
          type: 'Condition',
          iconName: 'CalendarClock',
          color: C2,
          settings: {
            startHour: 9,
            endHour: 17
          }
        }
      },
      {
        id: 'a3',
        type: 'custom',
        position: { x: 200, y: 570 },
        data: {
          title: 'Track Event',
          type: 'Action',
          iconName: 'BarChart2',
          color: C4,
          settings: {
            eventName: 'funnel_optimization_completed'
          }
        }
      }
    ],
    edges: [
      { id: 'e1', source: 't1', target: 'c1', animated: true },
      { id: 'e2', source: 'c1', target: 'a1', animated: true, data: { label: 'Mobile' } },
      { id: 'e3', source: 'c1', target: 'a2', animated: true, data: { label: 'Desktop' } },
      { id: 'e4', source: 'a1', target: 'c2', animated: true },
      { id: 'e5', source: 'a2', target: 'c2', animated: true },
      { id: 'e6', source: 'c2', target: 'a3', animated: true }
    ]
  },
  {
    id: 'smart-retargeting',
    name: 'Smart Retargeting',
    description: 'Intelligent retargeting based on multiple conditions and user segments.',
    category: 'Marketing',
    difficulty: 'Advanced',
    useCount: 156,
    rating: 4.7,
    tags: ['retargeting', 'segmentation', 'intelligence', 'marketing'],
    iconName: 'Target',
    nodes: [
      {
        id: 't1',
        type: 'custom',
        position: { x: 200, y: 50 },
        data: {
          title: 'Page View',
          type: 'Trigger',
          iconName: 'Eye',
          color: C1,
          settings: {}
        }
      },
      {
        id: 'c1',
        type: 'custom',
        position: { x: 100, y: 180 },
        data: {
          title: 'New vs Returning',
          type: 'Condition',
          iconName: 'UserPlus',
          color: C2,
          settings: {
            visitorType: 'returning'
          }
        }
      },
      {
        id: 'c2',
        type: 'custom',
        position: { x: 300, y: 180 },
        data: {
          title: 'Tag',
          type: 'Condition',
          iconName: 'Tag',
          color: C2,
          settings: {
            tagName: 'high-value'
          }
        }
      },
      {
        id: 'c3',
        type: 'custom',
        position: { x: 200, y: 310 },
        data: {
          title: 'Time Window',
          type: 'Condition',
          iconName: 'CalendarClock',
          color: C2,
          settings: {
            startHour: 18,
            endHour: 22
          }
        }
      },
      {
        id: 'a1',
        type: 'custom',
        position: { x: 200, y: 440 },
        data: {
          title: 'Show Modal',
          type: 'Action',
          iconName: 'MessageSquare',
          color: C4,
          settings: {
            modalTitle: 'Exclusive Evening Offer',
            modalContent: 'Special discount for our valued returning customers!'
          }
        }
      },
      {
        id: 'a2',
        type: 'custom',
        position: { x: 200, y: 570 },
        data: {
          title: 'Track Event',
          type: 'Action',
          iconName: 'BarChart2',
          color: C4,
          settings: {
            eventName: 'retargeting_modal_shown'
          }
        }
      }
    ],
    edges: [
      { id: 'e1', source: 't1', target: 'c1', animated: true },
      { id: 'e2', source: 't1', target: 'c2', animated: true },
      { id: 'e3', source: 'c1', target: 'c3', animated: true },
      { id: 'e4', source: 'c2', target: 'c3', animated: true },
      { id: 'e5', source: 'c3', target: 'a1', animated: true },
      { id: 'e6', source: 'a1', target: 'a2', animated: true }
    ]
  }
];

export function getWorkflowTemplateById(id: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find((t) => t.id === id);
}


