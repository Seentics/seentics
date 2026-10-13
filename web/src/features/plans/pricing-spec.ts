/**
 * What the pricing cards and the comparison table show, derived from the
 * plans' numeric limits (gateway/db/sql/030, 035) rather than their marketing
 * copy, so the page can't advertise a number the product doesn't enforce.
 *
 * Three plans: Free, Analytics ($9 a month, $84 a year) and Pro ($19 a month, $168 a year), each
 * stopping at its limits. Pro can go past its included amounts with Extra usage, turned on from
 * Billing and billed at OVERAGE_RATES. Pro stores each such limit as -1 with its included amount
 * beside it as `included_<key>`; Analytics and Free store a plain cap.
 *
 * Kept in sync by hand with observability/web/src/components/landing/pricing-spec.ts; the apps
 * share no code.
 */

export type PricingTier = 'free' | 'analytics' | 'pro';

/** The slice of a gateway plan this module reads. */
export type PricedPlan = {
  tier: PricingTier;
  priceMonthly: number;
  priceYearly?: number | null;
  limits: Record<string, Record<string, number> | undefined>;
};

export type BillingInterval = 'month' | 'year';

/** What a plan costs per month on an interval: yearly is the year's price spread over twelve months. */
export const monthlyPrice = (plan: PricedPlan, interval: BillingInterval): number =>
  interval === 'year' && plan.priceYearly ? plan.priceYearly / 12 : plan.priceMonthly;

/** The share saved by paying for the year, as a whole percentage; 0 when there is no yearly price. */
export const yearlySavingPercent = (plan: PricedPlan): number =>
  plan.priceYearly && plan.priceMonthly > 0 ? Math.round((1 - plan.priceYearly / (plan.priceMonthly * 12)) * 100) : 0;

/** The biggest saving across the plans, for the toggle: "Yearly (save up to 26%)". */
export const maxYearlySaving = (plans: PricedPlan[]): number => Math.max(0, ...plans.map(yearlySavingPercent));

/**
 * Past the included amounts. Must match the gateway's billing (gateway/billing/metering.ts RATES):
 * $0.01 per 1,000 events, $2 per 1,000 recordings, $0.25 per GB.
 */
export const OVERAGE_RATES = {
  events: { price: 0.01, per: 1_000, unit: 'events' },
  replays: { price: 2, per: 1_000, unit: 'recordings' },
  observeGb: { price: 0.25, per: 1, unit: 'GB' },
} as const;

export const TIER_PITCH: Record<PricingTier, string> = {
  free: 'Everything to get started, with monthly limits',
  analytics: 'Simple, privacy-friendly web analytics',
  pro: 'The full toolkit, with optional extra usage',
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

/** What a metered resource allows on this plan: Free's limit, or Pro's included amount. */
export function allowance(plan: PricedPlan, product: string, key: string): number | undefined {
  const value = limit(plan, product, key);
  return value === -1 ? (limit(plan, product, `included_${key}`) ?? -1) : value;
}

/** Whether usage past the allowance can be billed with Extra usage (Pro) rather than only refused (Free). */
export const isMetered = (plan: PricedPlan, product: string, key: string) =>
  limit(plan, product, key) === -1 && limit(plan, product, `included_${key}`) !== undefined;

// ---------------------------------------------------------------------------
// Cards: a short list, one line per allowance. The rest is in the comparison table.

/** `value` empty: a plain line, shown as its label alone. */
export type Highlight = { value: string; label: string };
export type CardSection = { title: string; items: Highlight[] };

const plural = (value: number | undefined, one: string, many: string) => (value === 1 ? one : many);

/** "$0.01 / 1K events · $2 / 1K recordings · $0.25 / GB": the rates in one line, for the billing page. */
export const RATES_LINE = Object.values(OVERAGE_RATES)
  .map((r) => `${formatMoney(r.price)} / ${r.per === 1 ? r.unit : `${formatCount(r.per)} ${r.unit}`}`)
  .join(' · ');

/** A card's two sections: what the plan includes each month, then what usage past that does. */
export function cardSectionsFor(plan: PricedPlan): CardSection[] {
  const core = (key: string) => limit(plan, 'core', key);
  const replays = allowance(plan, 'core', 'replays');
  const heatmaps = core('heatmaps');
  const funnels = core('funnels');
  const automations = core('automations');
  const leads = core('leads');
  const has = (value: number | undefined) => value !== undefined && value !== 0;
  const everything = heatmaps === -1 && funnels === -1 && automations === -1;

  const included: Highlight[] = [
    // "Up to": every plan stops at these by default, so the bill is predictable (Pro goes past them
    // only with Extra usage turned on).
    { value: `Up to ${formatCount(allowance(plan, 'core', 'monthly_events'))}`, label: 'events monthly' },
    ...(has(replays) ? [{ value: `Up to ${formatCount(replays)}`, label: 'session recordings monthly' }] : []),
    // Analytics does not cover Observability: it falls back to Free's, which the Analytics card does not advertise.
    ...(plan.tier !== 'analytics' ? [{ value: `Up to ${allowance(plan, 'observe', 'storage_gb')} GB`, label: 'of logs, traces & metrics monthly' }] : []),
    { value: formatDays(core('retention_days')), label: 'analytics retention' },
    { value: formatCount(core('websites')), label: 'websites' },
    everything
      ? { value: 'Unlimited', label: 'heatmaps, funnels & automations' }
      : plan.tier === 'analytics'
        ? { value: '', label: `Goals and ${formatCount(funnels)} basic ${plural(funnels, 'funnel', 'funnels')}` }
        : {
            value: '',
            label: `${formatCount(heatmaps)} ${plural(heatmaps, 'heatmap', 'heatmaps')}, ${formatCount(funnels)} ${plural(funnels, 'funnel', 'funnels')}, ${formatCount(automations)} ${plural(automations, 'automation', 'automations')}`,
          },
    ...(has(leads) ? [{ value: formatCount(leads), label: 'leads from popup forms' }] : []),
    { value: formatCount(core('ai_analyses')), label: 'AI analyses monthly' },
    // On every plan, so an agency can try it on Free. (White label will be Pro's; it is not
    // advertised until it is built.)
    { value: '', label: 'Agency: client accounts, APIs & embeds' },
  ];

  const extra: Highlight[] = plan.tier === 'pro'
    ? [
        { value: formatMoney(OVERAGE_RATES.events.price), label: `per ${formatCount(OVERAGE_RATES.events.per)} events` },
        { value: formatMoney(OVERAGE_RATES.replays.price), label: `per ${formatCount(OVERAGE_RATES.replays.per)} session recordings` },
        { value: formatMoney(OVERAGE_RATES.observeGb.price), label: 'per GB of logs, traces & metrics' },
        { value: '', label: 'Turn on extra usage from Billing in your dashboard' },
        { value: '', label: 'Optional monthly spend cap' },
      ]
    : plan.tier === 'analytics'
      ? [
          { value: '', label: 'Collection pauses at the limit until next month' },
          { value: '', label: 'Upgrade to Pro for replay, heatmaps, automations and lead capture' },
        ]
      : [
          { value: '', label: 'Collection pauses at a limit until next month' },
          { value: '', label: 'No card needed' },
        ];

  return [
    { title: 'Included', items: included },
    { title: plan.tier === 'pro' ? 'Extra usage (optional)' : 'At a limit', items: extra },
  ];
}

// ---------------------------------------------------------------------------
// Comparison table. `true` renders a check.

export type CompareRow = { label: string; value: (plan: PricedPlan) => string | boolean };
export type CompareGroup = { title: string; rows: CompareRow[] };

/** "Up to 300", or a dash for a plan that has none of it (a limit of 0). */
const meteredCell = (product: string, key: string, unit = '') => (p: PricedPlan): string | boolean => {
  const value = allowance(p, product, key);
  if (value === 0) return false;
  return `Up to ${unit ? `${value} ${unit}` : formatCount(value)}`;
};

/** A count, or a dash for a plan that has none of it. */
const countCell = (product: string, key: string) => (p: PricedPlan): string | boolean => {
  const value = limit(p, product, key);
  return value === 0 ? false : formatCount(value);
};

export const COMPARE_GROUPS: CompareGroup[] = [
  {
    title: 'Product analytics',
    rows: [
      { label: 'Events / month', value: meteredCell('core', 'monthly_events') },
      { label: 'Past the limit', value: (p) => (isMetered(p, 'core', 'monthly_events') ? 'Pauses, or extra usage at $0.01 / 1K' : 'Collection pauses') },
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
      { label: 'Past the limit', value: (p) => (allowance(p, 'core', 'replays') === 0 ? false : isMetered(p, 'core', 'replays') ? 'Pauses, or extra usage at $2 / 1K' : 'Recording pauses') },
      { label: 'Replay retention', value: (p) => (allowance(p, 'core', 'replays') === 0 ? false : formatDays(limit(p, 'core', 'replay_retention_days'))) },
      { label: 'Heatmaps', value: (p) => { const v = limit(p, 'core', 'heatmaps'); return v === 0 ? false : v === -1 ? 'Unlimited' : `${v} pages`; } },
    ],
  },
  {
    title: 'Observability',
    rows: [
      { label: 'Logs, traces & metrics / month', value: (p) => (p.tier === 'analytics' ? false : meteredCell('observe', 'storage_gb', 'GB')(p)) },
      { label: 'Past the limit', value: (p) => (p.tier === 'analytics' ? false : isMetered(p, 'observe', 'storage_gb') ? 'Pauses, or extra usage at $0.25 / GB' : 'Ingestion pauses') },
      { label: 'Telemetry retention', value: (p) => (p.tier === 'analytics' ? false : formatDays(limit(p, 'observe', 'retention_days'))) },
      { label: 'Error tracking & alerts', value: (p) => p.tier !== 'analytics' },
      { label: 'Uptime monitoring', value: (p) => p.tier !== 'analytics' },
    ],
  },
  {
    title: 'Automation, AI & teams',
    rows: [
      { label: 'Funnels', value: countCell('core', 'funnels') },
      { label: 'Automations', value: countCell('core', 'automations') },
      { label: 'Popups & lead capture', value: (p) => { const v = limit(p, 'core', 'leads'); return v === 0 ? false : `${formatCount(v)} leads`; } },
      { label: 'AI analyses / month', value: countCell('core', 'ai_analyses') },
      { label: 'Agency: client accounts, APIs & embeds', value: () => true },
      { label: 'Monthly spend cap on extra usage', value: (p) => p.tier === 'pro' },
      { label: 'Extra usage under $1 a month', value: (p) => (p.tier === 'pro' ? 'Not billed' : '—') },
      { label: 'Support', value: (p) => (p.tier === 'pro' ? 'Email' : 'Community') },
    ],
  },
];
