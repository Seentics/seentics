/**
 * What each pricing card and the comparison table show, derived from a
 * plan's numeric limits (gateway/db/sql/019_four_product_pricing.sql) rather
 * than its marketing copy — so the page can't advertise a number the
 * product doesn't enforce, and every card formats its numbers the same way.
 *
 * Kept in sync by hand with the copies in observability/web and uptime/web
 * (components/landing/pricing-spec.ts); the three apps share no code.
 */

export type PricingFamily = 'suite' | 'core' | 'observe';
export type PricingTier = 'free' | 'starter' | 'pro' | 'business';

/** The slice of a gateway plan this module reads. */
export type PricedPlan = {
  tier: PricingTier;
  limits: Record<string, Record<string, number> | undefined>;
};

const TIERS: PricingTier[] = ['free', 'starter', 'pro', 'business'];

export const TIER_PITCH: Record<PricingTier, string> = {
  free: 'For trying it out',
  starter: 'For small projects',
  pro: 'For growing teams',
  business: 'For high-traffic products',
};

const SUPPORT: Record<PricingTier, string> = {
  free: 'Community support',
  starter: 'Email support',
  pro: 'Email support',
  business: 'Priority support',
};

export function supportFor(tier: PricingTier): string {
  return SUPPORT[tier];
}

export const FAMILY_TAB: Record<PricingFamily, { label: string; caption: string; lead: string; includes: string }> = {
  suite: {
    label: 'Suite',
    caption: 'Analytics + Observability',
    lead: 'Analytics, Session Replay and AI, plus Observability for your backend, in one plan, for less than buying them separately.',
    includes: 'Every Suite plan includes unlimited websites, logs, metrics and traces.',
  },
  core: {
    label: 'Analytics',
    caption: 'Analytics, replay & AI',
    lead: 'More analytics capacity, without paying for products you don’t use.',
    includes: 'Every plan includes unlimited websites, session replay, heatmaps, funnels, automations and AI analysis.',
  },
  observe: {
    label: 'Observability',
    caption: 'Logs, metrics & traces',
    lead: 'Logs, metrics and traces on their own, with more storage than the Suite includes.',
    includes: 'Every plan includes logs, metrics, distributed traces and OpenTelemetry ingestion.',
  },
};

// ---------------------------------------------------------------------------
// Formatting

function limit(plan: PricedPlan, product: string, key: string): number | undefined {
  return plan.limits[product]?.[key];
}

export function formatCount(value: number | undefined): string {
  if (value === undefined) return '—';
  if (value === -1) return 'Unlimited';
  if (value >= 1_000_000) return `${+(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${+(value / 1_000).toFixed(1)}K`;
  return String(value);
}

export function formatDays(days: number | undefined): string {
  if (days === undefined) return '—';
  if (days === -1) return 'Unlimited';
  if (days >= 365 && days % 365 === 0) return days === 365 ? '1 year' : `${days / 365} years`;
  if (days >= 180 && days % 30 === 0) return `${days / 30} months`;
  return days === 1 ? '1 day' : `${days} days`;
}

export function formatInterval(seconds: number | undefined): string {
  if (seconds === undefined) return '—';
  if (seconds < 60) return `${seconds} sec`;
  return seconds === 60 ? '1 min' : `${Math.round(seconds / 60)} min`;
}

/**
 * About how much a plan lets you send in a month. The cap is on data kept
 * (OpenObserve's uncompressed `storage_size`), and at steady state what's
 * kept is one retention window's worth of sending — so a month's worth is
 * storage × 30 / retention. It's what other vendors quote (GB ingested per
 * month), which is why it's shown: "10 GB" beside a competitor's "50 GB
 * ingested" undersells a plan that takes ~43 GB a month.
 */
export function monthlySendGb(plan: PricedPlan): number | undefined {
  const storage = limit(plan, 'observe', 'storage_gb');
  const retention = limit(plan, 'observe', 'retention_days');
  if (storage === undefined || retention === undefined || storage === -1 || retention <= 0) return undefined;
  return Math.round((storage * 30) / retention);
}

const gb = (value: number | undefined) => (value === undefined ? '—' : value === -1 ? 'Unlimited' : `${value} GB`);

const byTier = <T,>(values: [T, T, T, T]) => (plan: PricedPlan) => values[TIERS.indexOf(plan.tier)] ?? values[0];

// ---------------------------------------------------------------------------
// Cards: the plan's allowances, one line each — value, then label — grouped
// by product on Suite cards so a longer list still scans.

/** `value` empty: an included feature, shown as its label alone. */
export type Highlight = { value: string; label: string };

const feature = (label: string): Highlight => ({ value: '', label });
export type CardSection = { title?: string; items: Highlight[] };

const plural = (value: number | undefined, one: string, many: string) => (value === 1 ? one : many);

function coreItems(plan: PricedPlan, withWebsites: boolean): Highlight[] {
  const core = (key: string) => limit(plan, 'core', key);
  const heatmaps = core('heatmaps');
  const funnels = core('funnels');
  const automations = core('automations');
  const items: Highlight[] = [
    { value: formatCount(core('monthly_events')), label: 'events / month' },
    { value: formatCount(core('replays')), label: 'session recordings / month' },
    { value: formatCount(core('ai_analyses')), label: 'AI analyses / month' },
    heatmaps === -1
      ? { value: 'Unlimited', label: 'heatmaps' }
      : { value: formatCount(heatmaps), label: plural(heatmaps, 'heatmap page', 'heatmap pages') },
    { value: formatCount(funnels), label: plural(funnels, 'funnel', 'funnels') },
    // A differentiator, so it gets its own line on every card that shows
    // Analytics — Suite included.
    { value: formatCount(automations), label: plural(automations, 'automation', 'automations') },
    { value: formatDays(core('retention_days')), label: 'data retention' },
  ];
  if (withWebsites) items.push({ value: formatCount(core('websites')), label: 'websites' });
  return items;
}

/** Included on every Analytics plan — the two things the card adds to the
 *  allowances; the rest of the feature list is in the comparison table. */
const CORE_FEATURES = [feature('Revenue & attribution'), feature('Cookieless, GDPR-ready')];

/** Which Analytics lines a Suite card keeps. */
const SUITE_CORE_LABELS = new Set(['events / month', 'session recordings / month', 'AI analyses / month', 'automation', 'automations', 'data retention']);

export function cardSectionsFor(family: PricingFamily, plan: PricedPlan): CardSection[] {
  const storage: Highlight = { value: gb(limit(plan, 'observe', 'storage_gb')), label: 'storage' };
  const observeRetention: Highlight = { value: formatDays(limit(plan, 'observe', 'retention_days')), label: 'retention' };
  const send = monthlySendGb(plan);
  const observeSend: Highlight = { value: send === undefined ? '—' : `≈ ${send} GB`, label: 'sent / month' };

  switch (family) {
    case 'suite':
      return [
        // The headline allowance of each product; the rest is one click away
        // in the comparison table.
        { title: 'Analytics', items: coreItems(plan, false).filter((item) => SUITE_CORE_LABELS.has(item.label)) },
        { title: 'Observability', items: [storage, observeRetention, observeSend] },
      ];
    case 'core':
      return [{ items: [...coreItems(plan, false), ...CORE_FEATURES] }];
    case 'observe': {
      const projects = limit(plan, 'observe', 'max_projects');
      const free = plan.tier === 'free';
      return [
        {
          items: [
            storage,
            observeRetention,
            observeSend,
            { value: formatCount(projects), label: plural(projects, 'project', 'projects') },
            { value: free ? 'Basic' : 'Unlimited', label: 'dashboards' },
            { value: free ? 'Basic' : 'Full', label: 'alerting' },
            feature('Error grouping'),
            feature('OpenTelemetry ingestion'),
          ],
        },
      ];
    }
  }
}

// ---------------------------------------------------------------------------
// Comparison table: every row of the pricing tables. `true` renders a check.

export type CompareRow = { label: string; value: (plan: PricedPlan) => string | boolean };
export type CompareGroup = { title?: string; rows: CompareRow[] };

const coreRows = (retentionLabel: string): CompareRow[] => [
  { label: 'Events / month', value: (p) => formatCount(limit(p, 'core', 'monthly_events')) },
  { label: 'Session recordings / month', value: (p) => formatCount(limit(p, 'core', 'replays')) },
  { label: 'AI analyses / month', value: (p) => formatCount(limit(p, 'core', 'ai_analyses')) },
  { label: 'Heatmaps', value: (p) => { const v = limit(p, 'core', 'heatmaps'); return v === -1 ? 'Unlimited' : v === undefined ? '—' : `${v} pages`; } },
  { label: 'Funnels', value: (p) => formatCount(limit(p, 'core', 'funnels')) },
  { label: 'Automations', value: (p) => formatCount(limit(p, 'core', 'automations')) },
  { label: retentionLabel, value: (p) => formatDays(limit(p, 'core', 'retention_days')) },
  { label: 'Websites', value: (p) => formatCount(limit(p, 'core', 'websites')) },
];

const observeRows: CompareRow[] = [
  { label: 'Storage', value: (p) => gb(limit(p, 'observe', 'storage_gb')) },
  { label: 'Retention', value: (p) => formatDays(limit(p, 'observe', 'retention_days')) },
  { label: 'Data you can send / month', value: (p) => { const v = monthlySendGb(p); return v === undefined ? '—' : `≈ ${v} GB`; } },
  { label: 'Logs, metrics & traces', value: () => true },
];

const supportRow: CompareRow = { label: 'Support', value: (p) => SUPPORT[p.tier].replace(' support', '') };

export function compareGroupsFor(family: PricingFamily): CompareGroup[] {
  switch (family) {
    case 'suite':
      return [
        { title: 'Analytics', rows: coreRows('Analytics retention') },
        { title: 'Observability', rows: observeRows },
        { rows: [supportRow] },
      ];
    case 'core':
      return [{ rows: [...coreRows('Data retention'), supportRow] }];
    case 'observe':
      return [
        {
          rows: [
            ...observeRows.slice(0, 3),
            { label: 'Logs', value: () => true },
            { label: 'Metrics', value: () => true },
            { label: 'Distributed traces', value: () => true },
            { label: 'OpenTelemetry ingestion', value: () => true },
            { label: 'Projects / services', value: (p) => formatCount(limit(p, 'observe', 'max_projects')) },
            { label: 'Dashboards', value: byTier(['Basic', 'Unlimited', 'Unlimited', 'Unlimited']) },
            { label: 'Alerting', value: byTier<string | boolean>(['Basic', true, true, true]) },
            supportRow,
          ],
        },
      ];
  }
}
