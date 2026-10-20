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
export function yearlySavingLabel(plans: PricedPlan | PricedPlan[], copy: PricingCopy = PRICING_EN): string {
  const list = Array.isArray(plans) ? plans : [plans];
  const months = Math.max(0, ...list.map(freeMonths));
  const exact = months > 0 && list.every((p) => !p.priceYearly || Math.abs(p.priceYearly - p.priceMonthly * (12 - months)) < 0.01);
  if (exact) return copy.monthsFree(months);
  const saving = maxYearlySaving(list);
  return saving > 0 ? copy.savePercent(saving) : '';
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
export function foundingNote(spots?: Pick<FoundingSpots, 'total' | 'claimed' | 'left' | 'status'> | null, copy: PricingCopy = PRICING_EN): FoundingNote {
  if (spots?.status === 'closed') return { show: false };
  const total = spots?.total ?? FOUNDING_OFFER.seats;
  const claimed = spots?.claimed ?? null;
  if (claimed === null || claimed < FOUNDING_COUNT_SHOWN_FROM) return { show: true, text: copy.founding.limitedTo(total), emphasised: false };
  const left = spots?.left ?? Math.max(0, total - claimed);
  if (left <= 0) return { show: false };
  return { show: true, text: copy.founding.onlyLeft(left, total), emphasised: left <= FOUNDING_EMPHASIS_LEFT };
}

/** What a plan costs with the founding code, per interval: the month's or the year's price, to the cent. */
export const foundingPrice = (plan: PricedPlan, interval: BillingInterval): number => {
  const price = interval === 'year' && plan.priceYearly ? plan.priceYearly : plan.priceMonthly;
  return Math.round(price * (100 - FOUNDING_OFFER.percentOff)) / 100;
};

// ---------------------------------------------------------------------------
// Copy. Every word the cards and the table say (src/lib/i18n), and what the tests read.

export type PricingCopy = {
  unlimited: string;
  free: string;
  days: (n: number) => string;
  years: (n: number) => string;
  monthsFree: (n: number) => string;
  savePercent: (n: number) => string;
  founding: {
    /** The availability line before the count is worth showing; starts with `limitedPrefix`. */
    limitedTo: (total: number) => string;
    limitedPrefix: string;
    onlyLeft: (left: number, total: number) => string;
  };
  tierPitch: Record<PricingTier, string>;
  card: {
    includedTitle: string;
    agencyTitle: string;
    upTo: (value: string) => string;
    events: string;
    sessionRecordings: string;
    contacts: string;
    aiAnalyses: string;
    websites: string;
    everything: string;
    /** "3 heatmaps, 1 funnel, 3 automations": the counts already formatted. */
    someOfEach: (heatmaps: { n: number | undefined; text: string }, funnels: { n: number | undefined; text: string }, automations: { n: number | undefined; text: string }) => string;
    adPlatforms: (n: number) => string;
    analyticsRetention: string;
    bothRetentions: (replayRetention: string) => string;
    agencyItems: { workspaces: string; whiteLabel: string; ownDomain: string; clientSignIn: string; embeds: string; api: string; support: string };
    atTheLimit: string;
    atALimit: string;
    past: { agency: [string, string]; pro: [string, string]; starter: [string, string]; free: [string, string] };
  };
  compare: {
    analytics: string;
    eventsPerMonth: string;
    pastTheLimit: string;
    collectionPauses: string;
    eventsExtraAgency: string;
    eventsExtraPro: string;
    dataRetention: string;
    websites: string;
    revenue: string;
    cookieless: string;
    replay: string;
    recordingsPerMonth: string;
    recordingPauses: string;
    replaysExtraAgency: string;
    replaysExtraPro: string;
    replayRetention: string;
    heatmaps: string;
    heatmapPages: (n: number) => string;
    automationGroup: string;
    funnels: string;
    automations: string;
    contacts: string;
    aiPerMonth: string;
    conversions: string;
    adPlatforms: (n: number, count: string) => string;
    apiAccess: string;
    spendCap: string;
    underADollar: string;
    notBilled: string;
    support: string;
    supportAgency: string;
    supportPro: string;
    supportCommunity: string;
    agency: string;
    clientWorkspaces: string;
    embeds: string;
    clientApi: string;
    whiteLabel: string;
    ownDomain: string;
    soon: string;
    clientSignIn: string;
  };
};

const plural = (value: number | undefined, one: string, many: string) => (value === 1 ? one : many);

export const PRICING_EN: PricingCopy = {
  unlimited: 'Unlimited',
  free: 'Free',
  days: (n) => (n === 1 ? '1 day' : `${n} days`),
  years: (n) => (n === 1 ? '1 year' : `${n} years`),
  monthsFree: (n) => `${n} ${n === 1 ? 'month' : 'months'} free`,
  savePercent: (n) => `save ${n}%`,
  founding: {
    limitedTo: (total) => `Limited to the first ${total} customers`,
    limitedPrefix: 'Limited to the ',
    onlyLeft: (left, total) => `Only ${left} of ${total} founding spots left`,
  },
  tierPitch: {
    free: 'Everything to get started',
    starter: 'The whole product for a growing site',
    pro: 'More of everything, with extra usage',
    agency: 'For agencies managing multiple client sites',
  },
  card: {
    includedTitle: 'Included every month',
    agencyTitle: 'Agency features',
    upTo: (value) => `Up to ${value}`,
    events: 'events',
    sessionRecordings: 'session recordings',
    contacts: 'contacts & form submissions a month',
    aiAnalyses: 'AI analyses',
    websites: 'websites',
    everything: 'heatmaps, funnels, automations',
    someOfEach: (h, f, a) =>
      `${h.text} ${plural(h.n, 'heatmap', 'heatmaps')}, ${f.text} ${plural(f.n, 'funnel', 'funnels')}, ${a.text} ${plural(a.n, 'automation', 'automations')}`,
    adPlatforms: (n) => `${plural(n, 'ad platform', 'ad platforms')} for server-side conversions`,
    analyticsRetention: 'analytics retention',
    bothRetentions: (replay) => `analytics retention, ${replay} replay retention`,
    agencyItems: {
      workspaces: 'client workspaces',
      whiteLabel: 'White-label branding: your logo, colours and name',
      ownDomain: 'Client dashboards on your own domain',
      clientSignIn: 'Client sign-in with pages you choose',
      embeds: 'Embeddable client dashboards',
      api: 'Agency API for clients, sites and usage',
      support: 'Priority support and personal onboarding',
    },
    atTheLimit: 'At the limit',
    atALimit: 'At a limit',
    past: {
      agency: ['Overage instead of pausing, with Extra usage', 'An alert at 80% of each allowance'],
      pro: ['Pauses, or keep going with Extra usage', 'Move to Agency any time'],
      starter: ['Collection pauses at the limit', 'Move to Pro any time'],
      free: ['Collection pauses at the limit', 'No card needed'],
    },
  },
  compare: {
    analytics: 'Product analytics',
    eventsPerMonth: 'Events / month',
    pastTheLimit: 'Past the limit',
    collectionPauses: 'Collection pauses',
    eventsExtraAgency: 'Extra usage at $0.01 / 1K, alert at 80%',
    eventsExtraPro: 'Pauses, or extra usage at $0.01 / 1K',
    dataRetention: 'Data retention',
    websites: 'Websites',
    revenue: 'Revenue & attribution',
    cookieless: 'Cookieless, GDPR-ready',
    replay: 'Session replay',
    recordingsPerMonth: 'Recordings / month',
    recordingPauses: 'Recording pauses',
    replaysExtraAgency: 'Extra usage at $2 / 1K, alert at 80%',
    replaysExtraPro: 'Pauses, or extra usage at $2 / 1K',
    replayRetention: 'Replay retention',
    heatmaps: 'Heatmaps',
    heatmapPages: (n) => `${n} pages`,
    automationGroup: 'Automation, AI & teams',
    funnels: 'Funnels',
    automations: 'Automations',
    contacts: 'Contacts & form submissions / month',
    aiPerMonth: 'AI analyses / month',
    conversions: 'Server-side conversions (Meta, GA4, TikTok, LinkedIn)',
    adPlatforms: (n, count) => `${count} ${plural(n, 'ad platform', 'ad platforms')}`,
    apiAccess: 'API access with account keys',
    spendCap: 'Monthly spend cap on extra usage',
    underADollar: 'Extra usage under $1 a month',
    notBilled: 'Not billed',
    support: 'Support',
    supportAgency: 'Priority, with onboarding',
    supportPro: 'Email',
    supportCommunity: 'Community',
    agency: 'Agency',
    clientWorkspaces: 'Client workspaces',
    embeds: 'Embedded client dashboards',
    clientApi: 'Client management API',
    whiteLabel: 'White-label branding',
    ownDomain: 'Client dashboards on your own domain (soon)',
    soon: 'Soon',
    clientSignIn: 'Client sign-in',
  },
};

export const TIER_PITCH: Record<PricingTier, string> = PRICING_EN.tierPitch;

// ---------------------------------------------------------------------------
// Formatting

const limit = (plan: PricedPlan, product: string, key: string) => plan.limits[product]?.[key];

export function formatCount(value: number | undefined, copy: PricingCopy = PRICING_EN): string {
  if (value === undefined) return '—';
  if (value === -1) return copy.unlimited;
  if (value >= 1_000_000) return `${+(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${+(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString('en-US');
}

export function formatDays(days: number | undefined, copy: PricingCopy = PRICING_EN): string {
  if (days === undefined) return '—';
  if (days === -1) return copy.unlimited;
  if (days >= 365 && days % 365 === 0) return copy.years(days / 365);
  return copy.days(days);
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
/** `soon`: sold with the plan but not live yet; the card says so rather than promise it. */
export type Highlight = { value: string; label: string; href?: string; soon?: boolean };
export type CardSection = { title: string; items: Highlight[] };

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
export function cardSectionsFor(plan: PricedPlan, copy: PricingCopy = PRICING_EN): CardSection[] {
  const c = copy.card;
  const count = (value: number | undefined) => formatCount(value, copy);
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

  // One order on every card, so the columns read alike: how much (events, recordings, contacts, AI),
  // then what (websites, heatmaps and the rest, ad platforms), then how long it is kept. Agency's
  // own features follow in a section of their own.
  const included: Highlight[] = [
    // "Up to": every plan stops at these by default, so the bill is predictable.
    { value: c.upTo(count(allowance(plan, 'core', 'monthly_events'))), label: c.events },
    ...(has(replays) ? [{ value: c.upTo(count(replays)), label: c.sessionRecordings }] : []),
    ...(has(leads) ? [{ value: count(leads), label: c.contacts }] : []),
    { value: count(core('ai_analyses')), label: c.aiAnalyses },
    { value: count(core('websites')), label: c.websites },
    everything
      ? { value: copy.unlimited, label: c.everything }
      : {
          value: '',
          label: c.someOfEach(
            { n: heatmaps, text: count(heatmaps) },
            { n: funnels, text: count(funnels) },
            { n: automations, text: count(automations) },
          ),
        },
    // Server-side conversions: only where the catalogue states the limit (gateway db/sql/042).
    ...(core('conversion_destinations') !== undefined && core('conversion_destinations') !== 0
      ? [{ value: count(core('conversion_destinations')), label: c.adPlatforms(core('conversion_destinations')!) }]
      : []),
    // Agency: one line for both retentions, as the card's copy reads.
    agency && has(replays) && replayRetention !== undefined
      ? { value: formatDays(core('retention_days'), copy), label: c.bothRetentions(formatDays(replayRetention, copy)) }
      : { value: formatDays(core('retention_days'), copy), label: c.analyticsRetention },
  ];

  // What only Agency has, after its numbers. Serving the dashboard on the agency's own domain
  // (phase 3) is not live yet: marked soon until it is. Client sign-in (phase 2) is live.
  const a = c.agencyItems;
  const agencyFeatures: CardSection = {
    title: c.agencyTitle,
    items: [
      { value: count(core('websites')), label: a.workspaces },
      { value: '', label: a.whiteLabel },
      { value: '', label: a.ownDomain, soon: true },
      { value: '', label: a.clientSignIn },
      { value: '', label: a.embeds },
      { value: '', label: a.api },
      { value: '', label: a.support },
    ],
  };

  // Free and Starter stop at a limit. Pro can turn on Extra usage from Billing; Agency is sold on
  // going past its amounts as overage instead of pausing, with an alert at 80% before it does.
  const lines = (pair: [string, string]) => pair.map((label) => ({ value: '', label }));
  const past: CardSection = agency
    ? { title: c.atTheLimit, items: lines(c.past.agency) }
    : plan.tier === 'pro'
      ? { title: c.atALimit, items: lines(c.past.pro) }
      : plan.tier === 'starter'
        ? { title: c.atALimit, items: lines(c.past.starter) }
        : { title: c.atALimit, items: lines(c.past.free) };

  return agency
    ? [{ title: c.includedTitle, items: included }, agencyFeatures, past]
    : [{ title: c.includedTitle, items: included }, past];
}

// ---------------------------------------------------------------------------
// Comparison table. `true` renders a check.

export type CompareRow = { label: string; value: (plan: PricedPlan) => string | boolean };
export type CompareGroup = { title: string; rows: CompareRow[] };

/** Pro and Agency can go past their included amounts with Extra usage. */
const extraUsage = (p: PricedPlan) => p.tier === 'pro' || p.tier === 'agency';

export function compareGroups(copy: PricingCopy = PRICING_EN): CompareGroup[] {
  const t = copy.compare;
  const count = (value: number | undefined) => formatCount(value, copy);

  /** "Up to 300", or a dash for a plan that has none of it (a limit of 0). */
  const meteredCell = (product: string, key: string) => (p: PricedPlan): string | boolean => {
    const value = allowance(p, product, key);
    if (value === 0 || value === undefined) return false;
    return copy.card.upTo(count(value));
  };

  /** A count, or a dash for a plan that has none of it. */
  const countCell = (product: string, key: string) => (p: PricedPlan): string | boolean => {
    const value = limit(p, product, key);
    return value === 0 ? false : count(value);
  };

  return [
    {
      title: t.analytics,
      rows: [
        { label: t.eventsPerMonth, value: meteredCell('core', 'monthly_events') },
        {
          label: t.pastTheLimit,
          value: (p) => (!isMetered(p, 'core', 'monthly_events')
            ? t.collectionPauses
            : hasAgencyFeatures(p) ? t.eventsExtraAgency : t.eventsExtraPro),
        },
        { label: t.dataRetention, value: (p) => formatDays(limit(p, 'core', 'retention_days'), copy) },
        { label: t.websites, value: (p) => count(limit(p, 'core', 'websites')) },
        { label: t.revenue, value: () => true },
        { label: t.cookieless, value: () => true },
      ],
    },
    {
      title: t.replay,
      rows: [
        { label: t.recordingsPerMonth, value: meteredCell('core', 'replays') },
        {
          label: t.pastTheLimit,
          value: (p) => (allowance(p, 'core', 'replays') === 0
            ? false
            : !isMetered(p, 'core', 'replays')
              ? t.recordingPauses
              : hasAgencyFeatures(p) ? t.replaysExtraAgency : t.replaysExtraPro),
        },
        { label: t.replayRetention, value: (p) => (allowance(p, 'core', 'replays') === 0 ? false : formatDays(limit(p, 'core', 'replay_retention_days'), copy)) },
        { label: t.heatmaps, value: (p) => { const v = limit(p, 'core', 'heatmaps'); return v === 0 ? false : v === -1 ? copy.unlimited : t.heatmapPages(v as number); } },
      ],
    },
    {
      title: t.automationGroup,
      rows: [
        { label: t.funnels, value: countCell('core', 'funnels') },
        { label: t.automations, value: countCell('core', 'automations') },
        { label: t.contacts, value: (p) => { const v = limit(p, 'core', 'leads'); return v === 0 ? false : copy.card.upTo(count(v)); } },
        { label: t.aiPerMonth, value: countCell('core', 'ai_analyses') },
        { label: t.conversions, value: (p) => { const v = limit(p, 'core', 'conversion_destinations'); return v === undefined || v === 0 ? false : t.adPlatforms(v, count(v)); } },
        { label: t.apiAccess, value: () => true },
        { label: t.spendCap, value: extraUsage },
        { label: t.underADollar, value: (p) => (extraUsage(p) ? t.notBilled : '—') },
        { label: t.support, value: (p) => (hasAgencyFeatures(p) ? t.supportAgency : p.tier === 'pro' ? t.supportPro : t.supportCommunity) },
      ],
    },
    {
      // Free, Starter and Pro are for one business; these are Agency's.
      title: t.agency,
      rows: [
        { label: t.clientWorkspaces, value: (p) => (hasAgencyFeatures(p) ? copy.unlimited : false) },
        { label: t.embeds, value: hasAgencyFeatures },
        { label: t.clientApi, value: hasAgencyFeatures },
        { label: t.whiteLabel, value: hasAgencyFeatures },
        { label: t.ownDomain, value: (p) => (hasAgencyFeatures(p) ? t.soon : false) },
        { label: t.clientSignIn, value: hasAgencyFeatures },
      ],
    },
  ];
}

export const COMPARE_GROUPS: CompareGroup[] = compareGroups(PRICING_EN);
