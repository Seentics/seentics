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

/**
 * Yearly billing is set up end to end (gateway catalogue, checkout, webhook) and priced, but not
 * offered yet: the pages sell monthly until the yearly variants exist in Lemon Squeezy. Turning this
 * on brings back the Monthly / Yearly toggle on the pricing page and in Billing.
 */
export const OFFER_YEARLY = false;

// `analytics` is Starter's tier: the plan kept its id when it became Starter (gateway db/sql/040).
export const TIER_PITCH: Record<PricingTier, string> = {
  free: 'Everything to get started',
  analytics: 'The whole product for a growing site',
  pro: 'More of everything, with extra usage',
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

/** `value` empty: a plain line, shown as its label alone. `href`: the line is a link. */
export type Highlight = { value: string; label: string; href?: string };
export type CardSection = { title: string; items: Highlight[] };

const plural = (value: number | undefined, one: string, many: string) => (value === 1 ? one : many);

/** "$0.01 / 1K events · $2 / 1K recordings · $0.25 / GB": the rates in one line, for the billing page. */
export const RATES_LINE = Object.values(OVERAGE_RATES)
  .map((r) => `${formatMoney(r.price)} / ${r.per === 1 ? r.unit : `${formatCount(r.per)} ${r.unit}`}`)
  .join(' · ');

/**
 * A card's two sections: what the plan includes each month, then what happens past it. Each line is
 * short enough to sit on one line in a card, so the lists scan; the section title carries "every month".
 */
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
    // "Up to": every plan stops at these by default, so the bill is predictable.
    { value: `Up to ${formatCount(allowance(plan, 'core', 'monthly_events'))}`, label: 'events' },
    ...(has(replays) ? [{ value: `Up to ${formatCount(replays)}`, label: 'session recordings' }] : []),
    // Only where the plan has an Observability allowance of its own.
    ...(allowance(plan, 'observe', 'storage_gb') !== undefined
      ? [{ value: `Up to ${allowance(plan, 'observe', 'storage_gb')} GB`, label: 'logs, traces & metrics' }]
      : []),
    { value: formatDays(core('retention_days')), label: 'analytics retention' },
    { value: formatCount(core('websites')), label: 'websites' },
    everything
      ? { value: 'Unlimited', label: 'heatmaps, funnels, automations' }
      : {
          value: '',
          label: `${formatCount(heatmaps)} ${plural(heatmaps, 'heatmap', 'heatmaps')}, ${formatCount(funnels)} ${plural(funnels, 'funnel', 'funnels')}, ${formatCount(automations)} ${plural(automations, 'automation', 'automations')}`,
        },
    ...(has(leads) ? [{ value: formatCount(leads), label: 'contacts & form submissions a month' }] : []),
    { value: formatCount(core('ai_analyses')), label: 'AI analyses' },
    // Server-side conversions: only where the catalogue states the limit (gateway db/sql/042).
    ...(core('conversion_destinations') !== undefined && core('conversion_destinations') !== 0
      ? [{
          value: formatCount(core('conversion_destinations')),
          label: `${plural(core('conversion_destinations')!, 'ad platform', 'ad platforms')} for server-side conversions`,
        }]
      : []),
    { value: '', label: 'Agency: clients, APIs & embeds' },
  ];

  // Extra usage still exists on Pro (Billing, and the docs), but is not spelled out on the card: a
  // bigger need is a conversation.
  const past: CardSection = plan.tier === 'pro'
    ? { title: 'Need more?', items: [{ value: '', label: 'Contact us for a custom plan', href: '/contact' }] }
    : plan.tier === 'analytics'
      ? { title: 'At a limit', items: [{ value: '', label: 'Collection pauses at the limit' }, { value: '', label: 'Move to Pro any time' }] }
      : { title: 'At a limit', items: [{ value: '', label: 'Collection pauses at the limit' }, { value: '', label: 'No card needed' }] };

  return [{ title: 'Included every month', items: included }, past];
}

// ---------------------------------------------------------------------------
// Comparison table. `true` renders a check.

export type CompareRow = { label: string; value: (plan: PricedPlan) => string | boolean };
export type CompareGroup = { title: string; rows: CompareRow[] };

/** "Up to 300", or a dash for a plan that has none of it (a limit of 0). */
const meteredCell = (product: string, key: string, unit = '') => (p: PricedPlan): string | boolean => {
  const value = allowance(p, product, key);
  if (value === 0 || value === undefined) return false;
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
      { label: 'Logs, traces & metrics / month', value: meteredCell('observe', 'storage_gb', 'GB') },
      { label: 'Past the limit', value: (p) => (allowance(p, 'observe', 'storage_gb') === undefined ? false : isMetered(p, 'observe', 'storage_gb') ? 'Pauses, or extra usage at $0.25 / GB' : 'Ingestion pauses') },
      { label: 'Telemetry retention', value: (p) => (limit(p, 'observe', 'retention_days') === undefined ? false : formatDays(limit(p, 'observe', 'retention_days'))) },
      { label: 'Error tracking & alerts', value: () => true },
      { label: 'Uptime monitoring', value: () => true },
    ],
  },
  {
    title: 'Automation, AI & teams',
    rows: [
      { label: 'Funnels', value: countCell('core', 'funnels') },
      { label: 'Automations', value: countCell('core', 'automations') },
      { label: 'Contacts & form submissions / month', value: (p) => { const v = limit(p, 'core', 'leads'); return v === 0 ? false : `Up to ${formatCount(v)}`; } },
      { label: 'AI analyses / month', value: countCell('core', 'ai_analyses') },
      { label: 'Server-side conversions (Meta, GA4, TikTok, LinkedIn)', value: (p) => { const v = limit(p, 'core', 'conversion_destinations'); return v === undefined || v === 0 ? false : `${formatCount(v)} ${plural(v, 'ad platform', 'ad platforms')}`; } },
      { label: 'Agency: client accounts, APIs & embeds', value: () => true },
      { label: 'Monthly spend cap on extra usage', value: (p) => p.tier === 'pro' },
      { label: 'Extra usage under $1 a month', value: (p) => (p.tier === 'pro' ? 'Not billed' : '—') },
      { label: 'Support', value: (p) => (p.tier === 'pro' ? 'Email' : 'Community') },
    ],
  },
];
