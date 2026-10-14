/**
 * Demo mode for the AI features: the daily insight, alerts, recommendations, the assistant,
 * session analyses and heatmap insights, all answered from here with no API call.
 *
 * One story runs through every surface, on the demo site's own pages and funnel: the pricing
 * page's plan cards draw clicks that go nowhere, the trial button sits below where most mobile
 * visitors stop scrolling, and a coupon error on checkout sends people away. The assistant's
 * replies are canned per topic and only use figures that appear elsewhere in the demo.
 *
 * Invented product data throughout, never a real customer's.
 */
import type { ActionProposal, AskResponse, ConversationSummary, ConversationTurn, DisplayBlock } from '@/features/ai/types';
import type { DailyInsight } from '@/features/ai/insights/types';
import type { AlertsResponse } from '@/features/ai/alerts/types';
import type { Recommendation } from '@/features/ai/recommendations/types';
import type { HeatmapInsights, InsightDevice } from '@/features/heatmaps/insights';
import type { SessionAnalysis } from '@/features/replays/analysis';
import type { SignalCounts } from '@/features/replays/types';

const DAY = 86_400_000;
const at = (daysAgo: number, hour = 9) => {
  const d = new Date(Date.now() - daysAgo * DAY);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
};
const today = () => new Date().toISOString().slice(0, 10);

// ─── Daily insight ─────────────────────────────────────────────────────────────

export function demoDailyInsight(): DailyInsight {
  return {
    date: today(),
    status: 'ready',
    source: 'ai',
    reason: null,
    createdAt: at(0, 5),
    lines: [
      {
        kind: 'finding',
        text: 'Visitors rose 8% week over week to 12,340, led by organic search (+21%).',
        evidence: { kind: 'traffic', label: 'Traffic', path: '' },
        action: null,
      },
      {
        kind: 'finding',
        text: 'On /pricing, 41% of mobile clicks land on the plan cards, which are not links.',
        evidence: { kind: 'page', label: '/pricing heatmap', path: 'heatmaps/_pricing' },
        action: null,
      },
      {
        kind: 'finding',
        text: 'Signup Start converts 22% of Pricing View visitors, down from 27% last week.',
        evidence: { kind: 'conversion', label: 'Main Conversion Path', path: 'funnels' },
        action: null,
      },
      {
        kind: 'action',
        text: 'Make the plan cards on /pricing clickable, or move the Start trial button above the fold on mobile.',
        evidence: { kind: 'page', label: '/pricing', path: 'heatmaps/_pricing' },
        action: { title: 'Ask AI how', prompt: 'How should I fix the dead clicks on the /pricing plan cards for mobile visitors?' },
      },
    ],
  };
}

// ─── Alerts ────────────────────────────────────────────────────────────────────

export function demoAlerts(): AlertsResponse {
  return {
    alerts: [
      {
        id: 'demo-alert-errors',
        type: 'error_surge',
        severity: 'high',
        status: 'open',
        title: 'Checkout errors surged',
        summary: '"Failed to fetch: POST /api/coupons/apply" happened 96 times in the last hour, usually 4.',
        explanation: 'It started after 09:00 and only on /checkout, which points at the coupon service rather than traffic.',
        explanationSource: 'ai',
        metric: 'errors',
        observed: 96,
        expected: 4,
        changePct: 2300,
        windowStart: at(0, 9),
        windowEnd: at(0, 10),
        detectedAt: at(0, 10),
        lastSeenAt: at(0, 10),
        resolvedAt: null,
        path: 'errors',
        askPrompt: 'Why are coupon requests failing on /checkout, and how many visitors did it affect?',
      },
      {
        id: 'demo-alert-spike',
        type: 'traffic_spike',
        severity: 'medium',
        status: 'resolved',
        title: 'Traffic spike from Hacker News',
        summary: '1,920 pageviews in an hour, about 6× the usual for a Tuesday morning.',
        explanation: 'Almost all of it came from news.ycombinator.com to /blog/why-real-time-matters.',
        explanationSource: 'ai',
        metric: 'pageviews',
        observed: 1920,
        expected: 310,
        changePct: 519,
        windowStart: at(1, 14),
        windowEnd: at(1, 15),
        detectedAt: at(1, 15),
        lastSeenAt: at(1, 17),
        resolvedAt: at(1, 18),
        path: '',
        askPrompt: 'What did the Hacker News visitors do after reading the blog post?',
      },
    ],
    settings: { enabled: true, sensitivity: 'normal' },
    canManage: false,
  };
}

// ─── Recommendations ───────────────────────────────────────────────────────────

const metric = (value: number, numerator: number, volume: number, fromDays: number, toDays: number) => ({
  value, numerator, volume, from: at(fromDays, 0), to: at(toDays, 0),
});

export function demoRecommendations(): Recommendation[] {
  const pricing = { kind: 'page' as const, ref: '/pricing', label: '/pricing', device: 'mobile' };
  return [
    {
      id: 'demo-rec-plan-cards',
      source: 'heatmap',
      title: 'Make the plan cards on /pricing clickable',
      rationale: '41% of mobile clicks on /pricing hit the plan cards, which are not links or buttons.',
      prompt: 'Draft a fix for the dead clicks on the /pricing plan cards for mobile visitors.',
      target: pricing,
      metric: { name: 'bounce_rate', windowDays: 14 },
      status: 'open',
      appliedAt: null,
      appliedVia: null,
      resource: null,
      createdAt: at(1, 6),
      updatedAt: at(0, 6),
      report: {
        recommendationId: 'demo-rec-plan-cards', status: 'not_applied', target: pricing,
        metric: { name: 'bounce_rate', windowDays: 14 }, appliedAt: null, baseline: null, checkpoints: [],
        verdict: null, headline: '', sentence: '', sentenceSource: 'rules', automation: null, caveats: [], nextCheckAt: null,
      },
    },
    {
      id: 'demo-rec-coupon',
      source: 'session',
      title: 'Look at the coupon field on /checkout',
      rationale: '14 frustrated sessions this week rage-clicked "Apply coupon" before leaving.',
      prompt: 'Show me the recordings where visitors struggled with the coupon field on /checkout.',
      target: { kind: 'page', ref: '/checkout', label: '/checkout' },
      metric: { name: 'conversion_rate', windowDays: 14 },
      status: 'open',
      appliedAt: null,
      appliedVia: null,
      resource: null,
      createdAt: at(0, 6),
      updatedAt: at(0, 6),
      report: {
        recommendationId: 'demo-rec-coupon', status: 'not_applied', target: { kind: 'page', ref: '/checkout', label: '/checkout' },
        metric: { name: 'conversion_rate', windowDays: 14 }, appliedAt: null, baseline: null, checkpoints: [],
        verdict: null, headline: '', sentence: '', sentenceSource: 'rules', automation: null, caveats: [], nextCheckAt: null,
      },
    },
    {
      id: 'demo-rec-exit-offer',
      source: 'assistant',
      title: 'Exit-intent offer on /pricing',
      rationale: 'Drafted from the assistant and switched on 16 days ago.',
      prompt: '',
      target: pricing,
      metric: { name: 'bounce_rate', windowDays: 14 },
      status: 'measured',
      appliedAt: at(16, 10),
      appliedVia: 'proposal',
      resource: { resource: 'automation', id: 'demo-automation-exit-offer' },
      createdAt: at(17, 10),
      updatedAt: at(2, 6),
      report: {
        recommendationId: 'demo-rec-exit-offer',
        status: 'measured',
        target: pricing,
        metric: { name: 'bounce_rate', windowDays: 14 },
        appliedAt: at(16, 10),
        baseline: metric(58, 2_436, 4_200, 30, 16),
        checkpoints: [
          { day: 7, measuredAt: at(9, 6), after: metric(54, 1_134, 2_100, 16, 9), verdict: 'improved', deltaPts: -4, z: -3.1, automation: null },
          { day: 14, measuredAt: at(2, 6), after: metric(52, 2_236, 4_300, 16, 2), verdict: 'improved', deltaPts: -6, z: -5.6, automation: null },
        ],
        verdict: 'improved',
        headline: 'Bounce rate −6 pts after 14 days (58% → 52%)',
        sentence: 'Mobile bounce on /pricing fell from 58% to 52% in the two weeks after the exit offer went live.',
        sentenceSource: 'ai',
        automation: { automationId: 'demo-automation-exit-offer', totalExecutions: 1_284, successCount: 1_284, failureCount: 0, last30Days: 1_284 },
        caveats: ['Before and after cover different weeks, so seasonality can account for part of the change.'],
        nextCheckAt: null,
      },
    },
  ];
}

// ─── Session analysis ─────────────────────────────────────────────────────────

/** Frustration for the demo replay list, by position, so the list has a range to filter and sort. */
export function demoSessionFrustration(index: number): { frustrationScore: number; signalCounts: SignalCounts; summary: string | null } {
  const table: Array<{ frustrationScore: number; signalCounts: SignalCounts; summary: string | null }> = [
    { frustrationScore: 76, signalCounts: { rage_click: 2, error_click: 1, u_turn: 1 }, summary: 'Tried to buy Pro with a coupon; the coupon failed and they left without paying.' },
    { frustrationScore: 12, signalCounts: {}, summary: 'Read the pricing page and compared plans, then left.' },
    { frustrationScore: 48, signalCounts: { dead_click: 3, scroll_thrash: 1 }, summary: 'Clicked div.plan-card "Pro" on /pricing and nothing happened (+3 more)' },
    { frustrationScore: 0, signalCounts: {}, summary: null },
    { frustrationScore: 31, signalCounts: { form_abandon: 1, u_turn: 1 }, summary: 'Started the signup form on /signup and gave up (+1 more)' },
    { frustrationScore: 5, signalCounts: {}, summary: 'Read the docs introduction and signed up for a trial.' },
    { frustrationScore: 62, signalCounts: { rage_click: 1, dead_click: 2 }, summary: 'Rage-clicked the Pro plan card 5 times on /pricing (+2 more)' },
    { frustrationScore: 0, signalCounts: {}, summary: null },
  ];
  return table[index % table.length]!;
}

export function demoSessionAnalysis(sessionId: string): SessionAnalysis {
  return {
    sessionId,
    status: 'ready',
    score: 76,
    counts: { rage_click: 2, error_click: 1, u_turn: 1 },
    signals: [
      { type: 'u_turn', atMs: 41_000, page: '/pricing', detail: 'Left /features after 6 s and came back' },
      { type: 'rage_click', atMs: 96_000, page: '/pricing', label: 'div.plan-card "Pro"', count: 5 },
      { type: 'error_click', atMs: 188_000, page: '/checkout', label: 'button "Apply coupon"', detail: 'Failed to fetch: POST /api/coupons/apply' },
      { type: 'rage_click', atMs: 192_000, page: '/checkout', label: 'button "Apply coupon"', count: 4 },
    ],
    timeline: {
      durationMs: 236_000,
      errorCount: 1,
      pages: [
        { path: '/', atMs: 0, dwellMs: 22_000 },
        { path: '/features', atMs: 22_000, dwellMs: 6_000 },
        { path: '/pricing', atMs: 41_000, dwellMs: 104_000 },
        { path: '/checkout', atMs: 145_000, dwellMs: 91_000 },
      ],
    },
    computedAt: at(0, 8),
    summary: {
      text:
        'A returning mobile visitor compared plans, tapped the Pro plan card five times expecting it to open, then went to ' +
        'checkout. Applying a coupon failed, they tapped "Apply coupon" four more times and left without paying.',
      intent: 'Buy the Pro plan with a coupon',
      outcome: 'abandoned',
      moments: [
        { atMs: 96_000, label: 'Taps the Pro plan card — it is not a link' },
        { atMs: 188_000, label: 'Coupon request fails' },
        { atMs: 192_000, label: 'Rage-clicks "Apply coupon", then leaves' },
      ],
    },
    summarySource: 'ai',
    summaryStatus: 'ready',
  };
}

// ─── Heatmap insights ──────────────────────────────────────────────────────────

export function demoHeatmapInsights(pagePath: string, days: number, device: InsightDevice): HeatmapInsights {
  const page = pagePath || '/';
  const isPricing = page.startsWith('/pricing');
  const scroll = {
    page_views: isPricing ? 42_187 : 18_420,
    reach: isPricing ? { p25: 88, p50: 61, p75: 34, p100: 18 } : { p25: 82, p50: 57, p75: 31, p100: 14 },
    median_depth: isPricing ? 58 : 52,
    avg_depth: isPricing ? 55 : 49,
    fold_pct: 28,
    viewport_px: 844,
    document_px: 3_020,
    stayed_above_fold_pct: 19,
  };
  const target = (selector: string, clicks: number, share: number, depth: number, interactive: boolean) => ({
    selector, tag: interactive ? 'a' : 'div', role: null, interactive, pinned: false,
    clicks, share, depth_pct: depth, reach_pct: Math.max(10, 100 - depth), above_fold: depth <= 28,
  });
  const clicks = {
    clicks: 15_432,
    clicks_per_view: 0.37,
    top: [
      target('div.plan-card.pro', 3_820, 24.8, 34, false),
      target('a.btn-start-trial', 2_210, 14.3, 72, true),
      target('nav a[href="/features"]', 1_480, 9.6, 2, true),
    ],
    top3_share: 48.7,
    bands: [{ from_pct: 0, to_pct: 30, clicks: 5_400, share: 35 }, { from_pct: 30, to_pct: 60, clicks: 7_100, share: 46 }, { from_pct: 60, to_pct: 100, clicks: 2_932, share: 19 }],
    above_fold_share: 35,
    dead_clicks: { clicks: 4_960, share: 32.1, known_share: 94, targets: [target('div.plan-card.pro', 3_820, 24.8, 34, false)] },
    ctas: [target('a.btn-start-trial', 2_210, 14.3, 72, true)],
  };
  const findings = [
    {
      signal: 'dead_clicks', kind: 'dead_clicks', device: 'mobile' as InsightDevice,
      finding: `32% of clicks on ${page} land on elements that do nothing — mostly the Pro plan card.`,
      fix: 'Make each plan card a link to its signup, or add a clear "Choose Pro" button inside it.',
    },
    {
      signal: 'cta_reach', kind: 'cta_reach', device: 'mobile' as InsightDevice,
      finding: 'The Start trial button sits at 72% of the page, and only 28% of page views scroll that far.',
      fix: 'Repeat the Start trial button under the plan comparison, near the fold.',
    },
    {
      signal: 'device_gap', kind: 'device_gap', device: 'all' as InsightDevice,
      finding: 'Mobile visitors stop scrolling at 31% of the page, desktop visitors at 64%.',
      fix: 'Shorten the mobile hero so the plans start on the first screen.',
    },
  ];
  return {
    analysis: {
      page_path: page,
      days,
      device,
      sufficient: true,
      reason: null,
      overall: { device: 'all', scroll, clicks },
      devices: [
        { device: 'desktop', scroll: { ...scroll, median_depth: 64 }, clicks },
        { device: 'mobile', scroll: { ...scroll, median_depth: 31 }, clicks },
      ],
      signals: findings.map((f, i) => ({ id: f.signal, kind: f.kind, device: f.device, score: 90 - i * 10, finding: f.finding, fix: f.fix, facts: '' })),
      limits: ['Rage clicks and time spent per section are not recorded for heatmaps yet.'],
    },
    insights: { source: 'ai', findings, generated_at: at(0, 7), reason: null, retry_after_sec: null },
    ai_configured: true,
  };
}

// ─── The assistant ─────────────────────────────────────────────────────────────

export function demoConversations(): ConversationSummary[] {
  return [
    { id: 'demo-thread-pricing', title: 'Why are mobile visitors struggling on /pricing?', messageCount: 2, lastMessageAt: at(0, 11) },
    { id: 'demo-thread-traffic', title: 'How is traffic doing this week?', messageCount: 2, lastMessageAt: at(1, 16) },
    { id: 'demo-thread-popup', title: 'Set up an exit offer on /pricing', messageCount: 2, lastMessageAt: at(3, 10) },
  ];
}

const THREAD_PROMPT: Record<string, string> = {
  'demo-thread-pricing': 'Why are mobile visitors struggling on /pricing?',
  'demo-thread-traffic': 'How is traffic doing this week?',
  'demo-thread-popup': 'Set up an exit-intent popup on /pricing offering 20% off the annual plan.',
};

export function demoConversation(conversationId: string): ConversationTurn[] {
  const prompt = THREAD_PROMPT[conversationId];
  if (!prompt) return [];
  const reply = demoAsk(prompt);
  return [{
    id: `${conversationId}-turn-1`,
    prompt,
    answer: reply.answer,
    proposal: reply.proposal,
    proposalAppliedAt: null,
    status: 'success',
    createdAt: demoConversations().find((t) => t.id === conversationId)?.lastMessageAt ?? at(0),
  }];
}

type Topic = { match: RegExp; answer: string; blocks: DisplayBlock[]; tools: string[]; proposal?: ActionProposal };

const TOPICS: Topic[] = [
  {
    match: /\b(popup|pop-up|modal|banner|toast|exit[- ]intent|exit offer|discount|automation)/i,
    answer:
      "I've drafted an exit-intent popup for /pricing offering 20% off the annual plan. It only shows on /pricing, " +
      'at most once per session, and stays off until you switch it on. Nothing changes until you review and confirm it below.',
    blocks: [],
    tools: ['list_automations', 'propose_automation'],
    proposal: {
      resource: 'automation',
      operation: 'create',
      payload: {},
      requiredRole: 'member',
      summary: {
        title: 'Pricing exit offer — 20% off annual',
        lines: ['Trigger: exit intent', 'Only on: /pricing', 'Action: show modal', 'title: 20% off the annual plan', 'Created inactive — it will not run until you enable it.'],
        hasExternalEffect: false,
        risks: [],
      },
    },
  },
  {
    match: /\b(checkout|coupon|cart|pay|purchas|order|revenue)/i,
    answer:
      'Checkout is losing people at the coupon step: "Failed to fetch: POST /api/coupons/apply" fired 96 times in the last ' +
      'hour (usually 4), and 14 sessions this week rage-clicked "Apply coupon" before leaving.\n\n' +
      '- The errors only happen on /checkout, starting after 09:00 today.\n' +
      '- The worst session (score 76) tried the coupon five times, then abandoned.\n\n' +
      'Next: check the coupon service, and watch the recording below. Want me to draft an alert snooze while it is fixed?',
    blocks: [
      { kind: 'metrics', items: [
        { label: 'Coupon errors (1h)', value: 96, delta: 23, format: 'number' },
        { label: 'Frustrated sessions', value: 14, format: 'number' },
      ] },
      { kind: 'links', items: [{ label: 'Watch: coupon fails, visitor leaves', sublabel: 'Score 76 · 3m 56s', href: '/websites/demo/replays/demo-session-1' }] },
    ],
    tools: ['list_error_groups', 'list_frustrated_sessions'],
  },
  {
    match: /\b(mobile|phone|device|pricing|plan|heatmap|click|scroll|fold|struggl)/i,
    answer:
      'Mobile visitors on /pricing are tapping things that do nothing: 32% of clicks land on non-interactive elements, ' +
      'mostly the Pro plan card, and the Start trial button sits below where 72% of them stop scrolling.\n\n' +
      '- Mobile visitors stop at 31% of the page; desktop at 64%.\n' +
      '- Only 28% of page views reach the Start trial button.\n\n' +
      'Next: make each plan card link to its signup, or repeat the Start trial button under the plans. Want me to draft that as a highlight on the button?',
    blocks: [
      { kind: 'metrics', items: [
        { label: 'Dead clicks', value: 0.321, format: 'percent' },
        { label: 'Reach Start trial', value: 0.28, format: 'percent' },
        { label: 'Mobile median scroll', value: 0.31, format: 'percent' },
      ] },
      { kind: 'links', items: [{ label: 'Open the /pricing heatmap', href: '/websites/demo/heatmaps/_pricing' }] },
    ],
    tools: ['get_heatmap_insights', 'get_audience_breakdown'],
  },
  {
    match: /\b(funnel|convert|conversion|signup|sign up|drop)/i,
    answer:
      'The Main Conversion Path converts 4.1% from Home Page to Signup Start over the last 7 days. The biggest leak is ' +
      'Pricing View → Signup Start: 78% drop off there, up from 73% last week.\n\n' +
      '- Most of that loss is on mobile, where the trial button is below the fold.\n\n' +
      'Next: fix the /pricing plan cards, then watch the funnel for a week.',
    blocks: [
      { kind: 'funnel', steps: [
        { label: 'Home Page', value: 12_340 },
        { label: 'Feature Explore', value: 5_180, conversionRate: 42 },
        { label: 'Pricing View', value: 2_310, conversionRate: 44.6 },
        { label: 'Signup Start', value: 508, conversionRate: 22 },
      ] },
    ],
    tools: ['list_funnels', 'get_funnel_performance'],
  },
  {
    match: /\b(error|broken|bug|crash|fail)/i,
    answer:
      'One error needs attention: "Failed to fetch: POST /api/coupons/apply" on /checkout fired 96 times in the last hour ' +
      '(usually 4). The other unresolved error, a ResizeObserver warning on /, is noisy but harmless.\n\n' +
      'Next: check the coupon service; I can draft marking the ResizeObserver warning as ignored.',
    blocks: [
      { kind: 'table', columns: [
        { key: 'message', label: 'Error' }, { key: 'page', label: 'Page' }, { key: 'count', label: 'Last 7 days', format: 'number' },
      ], rows: [
        { message: 'Failed to fetch: POST /api/coupons/apply', page: '/checkout', count: 214 },
        { message: 'ResizeObserver loop completed with undelivered notifications.', page: '/', count: 1_840 },
      ] },
    ],
    tools: ['list_error_groups'],
  },
  {
    match: /\b(recording|session|replay|watch|frustrat|rage)/i,
    answer:
      'This week 14 sessions scored as frustrated. The worst ones share a pattern: a tap on the Pro plan card that does ' +
      'nothing, then a failed coupon on /checkout.\n\nNext: watch the top one below — it shows both in under four minutes.',
    blocks: [
      { kind: 'links', items: [
        { label: 'Coupon fails, visitor leaves', sublabel: 'Score 76 · rage clicks, error click', href: '/websites/demo/replays/demo-session-1' },
        { label: 'Taps the plan card repeatedly', sublabel: 'Score 62 · rage click, dead clicks', href: '/websites/demo/replays/demo-session-7' },
      ] },
    ],
    tools: ['list_frustrated_sessions'],
  },
];

const TRAFFIC: Topic = {
  match: /./,
  answer:
    'Traffic is up: 12,340 visitors in the last 7 days, 8% more than the week before, led by organic search (+21%). ' +
    'Bounce rate held at 42%.\n\n' +
    '- /pricing is the second most visited page, and its mobile visitors struggle most.\n\n' +
    'Next: look at the /pricing heatmap — that is where the extra visitors are being lost.',
  blocks: [
    { kind: 'metrics', items: [
      { label: 'Visitors', value: 12_340, delta: 0.08, format: 'number' },
      { label: 'Pageviews', value: 40_100, delta: 0.05, format: 'number' },
      { label: 'Bounce rate', value: 0.42, delta: 0, format: 'percent' },
    ] },
    { kind: 'timeseries', xKey: 'day', series: [{ key: 'visitors', label: 'Visitors' }], rows: [
      { day: 'Mon', visitors: 1_620 }, { day: 'Tue', visitors: 2_410 }, { day: 'Wed', visitors: 1_780 },
      { day: 'Thu', visitors: 1_710 }, { day: 'Fri', visitors: 1_690 }, { day: 'Sat', visitors: 1_480 }, { day: 'Sun', visitors: 1_650 },
    ] },
  ],
  tools: ['get_traffic_summary', 'get_top_sources'],
};

let demoQueries = 0;

/** A canned reply for the demo assistant, chosen by what the question is about. */
export function demoAsk(prompt: string): AskResponse {
  const topic = TOPICS.find((t) => t.match.test(prompt)) ?? TRAFFIC;
  demoQueries += 1;
  return {
    conversationId: 'demo-conversation',
    queryId: `demo-query-${demoQueries}`,
    answer: topic.answer,
    blocks: topic.blocks,
    proposal: topic.proposal ?? null,
    toolsUsed: topic.tools,
    tokens: { input: 0, output: 0 },
    estimatedCostUsd: 0,
    executionTimeMs: 900,
  };
}

/** Feels like a model call without being one. */
export const demoDelay = (ms = 700) => new Promise<void>((resolve) => setTimeout(resolve, ms));
