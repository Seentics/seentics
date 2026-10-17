/**
 * What the pricing cards and the comparison table show, derived from the
 * plans' numeric limits (gateway/db/sql/030, 035) rather than their marketing
 * copy, so the page can't advertise a number the product doesn't enforce.
 *
 * Four plans: Free, Starter ($9 a month, $90 a year), Pro ($24, $240) and
 * Agency ($99, $990). Free and Starter stop at their limits. Pro and Agency can go past their
 * included amounts with Extra usage, turned on from Billing and billed at OVERAGE_RATES; they store
 * each such limit as -1 with its included amount beside it as `included_<key>`. Agency alone has
 * `core.agency_features`: client workspaces, embeds, client access, white label and a custom domain.
 *
 * Observability is not marketed here any more: its allowance stays in the catalogue and in Billing,
 * but the cards and the table leave it out.
 *
 * Kept in sync by hand with observability/web/src/components/landing/pricing-spec.ts; the apps
 * share no code.
 */

import type { FoundingSpots } from './types';

export type PricingTier = 'free' | 'starter' | 'pro' | 'agency';

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

/** The biggest saving across the plans, as a percentage. */
export const maxYearlySaving = (plans: PricedPlan[]): number => Math.max(0, ...plans.map(yearlySavingPercent));

/** How many months of the year paying yearly leaves free: $90 against $9 a month is 2. */
export const freeMonths = (plan: PricedPlan): number =>
  plan.priceYearly && plan.priceMonthly > 0 ? Math.max(0, Math.round(12 - plan.priceYearly / plan.priceMonthly)) : 0;

/** The yearly saving in words, for the toggle and the cards: "2 months free", or "save 17%" when it isn't whole months. */
export function yearlySavingLabel(plans: PricedPlan | PricedPlan[]): string {
  const list = Array.isArray(plans) ? plans : [plans];
  const months = Math.max(0, ...list.map(freeMonths));
  const exact = months > 0 && list.every((p) => !p.priceYearly || Math.abs(p.priceYearly - p.priceMonthly * (12 - months)) < 0.01);
  if (exact) return `${months} ${months === 1 ? 'month' : 'months'} free`;
  const saving = maxYearlySaving(list);
  return saving > 0 ? `save ${saving}%` : '';
}

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
 * Yearly billing on every paid plan, two months free: the Monthly / Yearly toggle on the pricing
 * page, and "Switch to yearly" in Billing. Off, the pages sell monthly only.
 */
export const OFFER_YEARLY = true;

/**
 * The founding offer for the first customers: 30% off Pro or Agency, monthly or yearly, on every
 * renewal, with a Lemon Squeezy discount code limited to `seats` redemptions in all. Sent to
 * checkout (as `discount`) only when the visitor claims it.
 */
export const FOUNDING_OFFER = {
  code: 'FOUNDING30',
  percentOff: 30,
  plans: ['pro', 'agency'] as readonly PricingTier[],
  seats: 50,
} as const;

/** Below this many claims the count is not shown, only the limit: "Limited to the first 50 customers". */
export const FOUNDING_COUNT_SHOWN_FROM = 10;
/** At or below this many spots left, the count is emphasised. */
export const FOUNDING_EMPHASIS_LEFT = 5;

export type FoundingNote = { show: false } | { show: true; text: string; emphasised: boolean };

/**
 * What the founding box says about availability, from Lemon Squeezy's count (gateway's
 * /billing/founding). Never made up: an unknown or small count shows only the limit, a closed offer
 * hides the box, and without an answer the limit is FOUNDING_OFFER.seats.
 */
export function foundingNote(spots?: Pick<FoundingSpots, 'total' | 'claimed' | 'left' | 'status'> | null): FoundingNote {
  if (spots?.status === 'closed') return { show: false };
  const total = spots?.total ?? FOUNDING_OFFER.seats;
  const claimed = spots?.claimed ?? null;
  if (claimed === null || claimed < FOUNDING_COUNT_SHOWN_FROM) return { show: true, text: `Limited to the first ${total} customers`, emphasised: false };
  const left = spots?.left ?? Math.max(0, total - claimed);
  if (left <= 0) return { show: false };
  return { show: true, text: `Only ${left} of ${total} founding spots left`, emphasised: left <= FOUNDING_EMPHASIS_LEFT };
}

/** What a plan costs with the founding code, per interval: the month's or the year's price, to the cent. */
export const foundingPrice = (plan: PricedPlan, interval: BillingInterval): number => {
  const price = interval === 'year' && plan.priceYearly ? plan.priceYearly : plan.priceMonthly;
  return Math.round(price * (100 - FOUNDING_OFFER.percentOff)) / 100;
};

export const TIER_PITCH: Record<PricingTier, string> = {
  free: 'Everything to get started',
  starter: 'The whole product for a growing site',
  pro: 'More of everything, with extra usage',
  agency: 'For agencies managing multiple client sites',
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

/** Whether a plan has the agency features (client workspaces, embeds): Agency only. */
export const hasAgencyFeatures = (plan: PricedPlan) =>
  plan.tier === 'agency' || (limit(plan, 'core', 'agency_features') ?? 0) > 0;

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
  const agency = hasAgencyFeatures(plan);
  const replayRetention = core('replay_retention_days');

  const included: Highlight[] = [
    // "Up to": every plan stops at these by default, so the bill is predictable.
    { value: `Up to ${formatCount(allowance(plan, 'core', 'monthly_events'))}`, label: 'events' },
    ...(has(replays) ? [{ value: `Up to ${formatCount(replays)}`, label: 'session recordings' }] : []),
    // Agency: one line for both retentions, as the card's copy reads.
    agency && has(replays) && replayRetention !== undefined
      ? { value: formatDays(core('retention_days')), label: `analytics retention, ${formatDays(replayRetention)} replay retention` }
      : { value: formatDays(core('retention_days')), label: 'analytics retention' },
    agency
      ? { value: formatCount(core('websites')), label: 'client workspaces and websites' }
      : { value: formatCount(core('websites')), label: 'websites' },
    ...(agency ? [{ value: '', label: 'Client access and white-label reports on your own domain' }] : []),
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
    ...(agency ? [{ value: '', label: 'Priority support and personal onboarding' }] : []),
  ];

  // Free and Starter stop at a limit. Pro can turn on Extra usage from Billing; Agency is sold on
  // going past its amounts as overage instead of pausing, with an alert at 80% before it does.
  const past: CardSection = agency
    ? { title: 'At the limit', items: [{ value: '', label: 'Overage instead of pausing, with Extra usage' }, { value: '', label: 'An alert at 80% of each allowance' }] }
    : plan.tier === 'pro'
      ? { title: 'At a limit', items: [{ value: '', label: 'Pauses, or keep going with Extra usage' }, { value: '', label: 'Move to Agency any time' }] }
      : plan.tier === 'starter'
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

/** Pro and Agency can go past their included amounts with Extra usage. */
const extraUsage = (p: PricedPlan) => p.tier === 'pro' || p.tier === 'agency';

export const COMPARE_GROUPS: CompareGroup[] = [
  {
    title: 'Product analytics',
    rows: [
      { label: 'Events / month', value: meteredCell('core', 'monthly_events') },
      {
        label: 'Past the limit',
        value: (p) => (!isMetered(p, 'core', 'monthly_events')
          ? 'Collection pauses'
          : hasAgencyFeatures(p) ? 'Extra usage at $0.01 / 1K, alert at 80%' : 'Pauses, or extra usage at $0.01 / 1K'),
      },
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
      {
        label: 'Past the limit',
        value: (p) => (allowance(p, 'core', 'replays') === 0
          ? false
          : !isMetered(p, 'core', 'replays')
            ? 'Recording pauses'
            : hasAgencyFeatures(p) ? 'Extra usage at $2 / 1K, alert at 80%' : 'Pauses, or extra usage at $2 / 1K'),
      },
      { label: 'Replay retention', value: (p) => (allowance(p, 'core', 'replays') === 0 ? false : formatDays(limit(p, 'core', 'replay_retention_days'))) },
      { label: 'Heatmaps', value: (p) => { const v = limit(p, 'core', 'heatmaps'); return v === 0 ? false : v === -1 ? 'Unlimited' : `${v} pages`; } },
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
      { label: 'API access with account keys', value: () => true },
      { label: 'Monthly spend cap on extra usage', value: extraUsage },
      { label: 'Extra usage under $1 a month', value: (p) => (extraUsage(p) ? 'Not billed' : '—') },
      { label: 'Support', value: (p) => (hasAgencyFeatures(p) ? 'Priority, with onboarding' : p.tier === 'pro' ? 'Email' : 'Community') },
    ],
  },
  {
    // Free, Starter and Pro are for one business; these are Agency's.
    title: 'Agency',
    rows: [
      { label: 'Client workspaces', value: (p) => (hasAgencyFeatures(p) ? 'Unlimited' : false) },
      { label: 'Embedded client dashboards', value: hasAgencyFeatures },
      { label: 'Client management API', value: hasAgencyFeatures },
      { label: 'Client access & white-label reports', value: hasAgencyFeatures },
    ],
  },
];
