/**
 * What the pricing cards and the comparison table show, derived from the
 * plans' numeric limits (gateway/db/sql/028_pay_as_you_go.sql) rather than their marketing copy,
 * so the page can't advertise a number the product doesn't enforce.
 *
 * Two plans: Free, hard-capped, and Pay-As-You-Go, $15 a month with usage past its included amounts
 * billed at OVERAGE_RATES. Pay-As-You-Go stores each metered limit as -1 (unlimited) with its
 * included amount beside it as `included_<key>`.
 *
 * Kept in sync by hand with observability/web/src/components/landing/pricing-spec.ts; the apps
 * share no code.
 */

export type PricingTier = 'free' | 'payg';

/** The slice of a gateway plan this module reads. */
export type PricedPlan = {
  tier: PricingTier;
  priceMonthly: number;
  limits: Record<string, Record<string, number> | undefined>;
};

/**
 * Past the included amounts. Must match the gateway's billing (gateway/services/metering.ts RATES):
 * $0.01 per 1,000 events, $1 per 1,000 recordings, $0.25 per GB.
 */
export const OVERAGE_RATES = {
  events: { price: 0.01, per: 1_000, unit: 'events' },
  replays: { price: 1, per: 1_000, unit: 'recordings' },
  observeGb: { price: 0.25, per: 1, unit: 'GB' },
} as const;

export const TIER_PITCH: Record<PricingTier, string> = {
  free: 'Everything to get started, with monthly limits',
  payg: 'Generous included usage, then flat rates',
};

// ---------------------------------------------------------------------------
// Formatting

const limit = (plan: PricedPlan, product: string, key: string) => plan.limits[product]?.[key];

export function formatCount(value: number | undefined): string {
  if (value === undefined) return '—';
  if (value === -1) return 'Unlimited';
  if (value >= 1_000_000) return `${+(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${+(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString('en-US');
}

export function formatDays(days: number | undefined): string {
  if (days === undefined) return '—';
  if (days === -1) return 'Unlimited';
  if (days >= 365 && days % 365 === 0) return days === 365 ? '1 year' : `${days / 365} years`;
  return days === 1 ? '1 day' : `${days} days`;
}

export const formatMoney = (dollars: number) =>
  dollars >= 1_000 ? `$${Math.round(dollars).toLocaleString('en-US')}` : `$${dollars.toFixed(2).replace(/\.00$/, '')}`;

/**
 * What a metered resource allows on this plan: Free's hard limit, or Pay-As-You-Go's included
 * amount (its limit itself is unlimited).
 */
export function allowance(plan: PricedPlan, product: string, key: string): number | undefined {
  const value = limit(plan, product, key);
  return value === -1 ? (limit(plan, product, `included_${key}`) ?? -1) : value;
}

/** Whether usage past the allowance is billed (Pay-As-You-Go) rather than refused (Free). */
export const isMetered = (plan: PricedPlan, product: string, key: string) =>
  limit(plan, product, key) === -1 && limit(plan, product, `included_${key}`) !== undefined;

// ---------------------------------------------------------------------------
// Cards: a short list, one line per allowance. The rest is in the comparison table.

/** `value` empty: a plain line, shown as its label alone. */
export type Highlight = { value: string; label: string };
export type CardSection = { title: string; items: Highlight[] };

const plural = (value: number | undefined, one: string, many: string) => (value === 1 ? one : many);

/** "$0.01 / 1K events · $1 / 1K recordings · $0.25 / GB": the rates in one line, for the billing page. */
export const RATES_LINE = Object.values(OVERAGE_RATES)
  .map((r) => `${formatMoney(r.price)} / ${r.per === 1 ? r.unit : `${formatCount(r.per)} ${r.unit}`}`)
  .join(' · ');

/** A card's two sections: what the plan includes each month, then what usage past that does. */
export function cardSectionsFor(plan: PricedPlan): CardSection[] {
  const core = (key: string) => limit(plan, 'core', key);
  const heatmaps = core('heatmaps');
  const funnels = core('funnels');
  const automations = core('automations');

  const included: Highlight[] = [
    { value: formatCount(allowance(plan, 'core', 'monthly_events')), label: 'events monthly' },
    { value: formatCount(allowance(plan, 'core', 'replays')), label: 'session recordings monthly' },
    { value: `${allowance(plan, 'observe', 'storage_gb')} GB`, label: 'logs, traces & metrics sent monthly' },
    { value: formatDays(core('retention_days')), label: 'analytics retention' },
    { value: formatCount(core('websites')), label: 'websites' },
    heatmaps === -1 && funnels === -1 && automations === -1
      ? { value: 'Unlimited', label: 'heatmaps, funnels & automations' }
      : {
          value: '',
          label: `${formatCount(heatmaps)} ${plural(heatmaps, 'heatmap', 'heatmaps')}, ${formatCount(funnels)} ${plural(funnels, 'funnel', 'funnels')}, ${formatCount(automations)} ${plural(automations, 'automation', 'automations')}`,
        },
    { value: formatCount(core('ai_analyses')), label: 'AI analyses monthly' },
    { value: '', label: 'Agency: client accounts, APIs & embeds' },
    ...(plan.tier === 'payg' ? [{ value: '', label: 'White label with your own brand' }] : []),
  ];

  const extra: Highlight[] = plan.tier === 'payg'
    ? [
        { value: formatMoney(OVERAGE_RATES.events.price), label: `per ${formatCount(OVERAGE_RATES.events.per)} events` },
        { value: formatMoney(OVERAGE_RATES.replays.price), label: `per ${formatCount(OVERAGE_RATES.replays.per)} session recordings` },
        { value: formatMoney(OVERAGE_RATES.observeGb.price), label: 'per GB of logs, traces & metrics' },
        { value: '', label: 'Optional monthly spend cap' },
      ]
    : [
        { value: '', label: 'Collection pauses at a limit until next month' },
        { value: '', label: 'No card needed' },
      ];

  return [
    { title: 'Included', items: included },
    { title: plan.tier === 'payg' ? 'Extra usage' : 'At a limit', items: extra },
  ];
}

// ---------------------------------------------------------------------------
// Comparison table. `true` renders a check.

export type CompareRow = { label: string; value: (plan: PricedPlan) => string | boolean };
export type CompareGroup = { title: string; rows: CompareRow[] };

const meteredCell = (product: string, key: string, unit = '') => (p: PricedPlan) => {
  const value = allowance(p, product, key);
  const shown = unit ? `${value} ${unit}` : formatCount(value);
  return isMetered(p, product, key) ? `${shown} included` : shown;
};

export const COMPARE_GROUPS: CompareGroup[] = [
  {
    title: 'Product analytics',
    rows: [
      { label: 'Events / month', value: meteredCell('core', 'monthly_events') },
      { label: 'Past the limit', value: (p) => (isMetered(p, 'core', 'monthly_events') ? '$0.01 / 1K events' : 'Collection pauses') },
      { label: 'Data retention', value: (p) => formatDays(limit(p, 'core', 'retention_days')) },
      { label: 'Websites', value: (p) => formatCount(limit(p, 'core', 'websites')) },
      { label: 'Revenue & attribution', value: () => true },
      { label: 'Cookieless, GDPR-ready', value: () => true },
    ],
  },
  {
    title: 'Session replay',
    rows: [
      { label: 'Recordings / month', value: meteredCell('core', 'replays') },
      { label: 'Past the limit', value: (p) => (isMetered(p, 'core', 'replays') ? '$1 / 1K recordings' : 'Recording pauses') },
      { label: 'Replay retention', value: (p) => formatDays(limit(p, 'core', 'replay_retention_days')) },
      { label: 'Heatmaps', value: (p) => { const v = limit(p, 'core', 'heatmaps'); return v === -1 ? 'Unlimited' : `${v} pages`; } },
    ],
  },
  {
    title: 'Observability',
    rows: [
      { label: 'Logs, traces & metrics / month', value: meteredCell('observe', 'storage_gb', 'GB') },
      { label: 'Past the limit', value: (p) => (isMetered(p, 'observe', 'storage_gb') ? '$0.25 / GB' : 'Ingestion pauses') },
      { label: 'Telemetry retention', value: (p) => formatDays(limit(p, 'observe', 'retention_days')) },
      { label: 'Error tracking & alerts', value: () => true },
      { label: 'Uptime monitoring', value: () => true },
    ],
  },
  {
    title: 'Automation, AI & teams',
    rows: [
      { label: 'Funnels', value: (p) => formatCount(limit(p, 'core', 'funnels')) },
      { label: 'Automations', value: (p) => formatCount(limit(p, 'core', 'automations')) },
      { label: 'AI analyses / month', value: (p) => formatCount(limit(p, 'core', 'ai_analyses')) },
      { label: 'Agency: client accounts, APIs & embeds', value: () => true },
      { label: 'White label', value: (p) => p.tier === 'payg' },
      { label: 'Monthly spend cap', value: (p) => p.tier === 'payg' },
      { label: 'Support', value: (p) => (p.tier === 'payg' ? 'Email' : 'Community') },
    ],
  },
];
