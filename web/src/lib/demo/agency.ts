/**
 * Agency workspace demo data: "Northwind Digital", an agency on the Agency plan with eight
 * clients and their websites.
 *
 * Everything is derived from one table of websites (`SITES`), so the figures agree wherever they
 * show: a client's usage is the sum of its websites', the pool totals are the sum of every row,
 * the overview's client rows add up to its totals, and the alerts point at the sites whose
 * figures explain them. Shapes are the agency API's (`features/agency/types.ts`), snake_case as on
 * the wire, and dates move with today (`demoDate`), like the website demo's.
 *
 * `demoAgencyResponse(method, path, …)` answers a call from `features/agency/api.ts` with the body
 * the API would send, keyed on the path exactly as api.ts writes it (`/agency/clients/:id`).
 */

import type {
  AgencyAlert,
  AgencyWebsite,
  Branding,
  Caps,
  Client,
  ClientDetail,
  ClientFeatures,
  ClientUser,
  ClientUserStatus,
  ClientStatus,
  CollectFeature,
  Domain,
  DomainState,
  Embed,
  FeatureAccess,
  FeatureId,
  InstallMethod,
  ListResponse,
  MetricTotals,
  Mover,
  Overview,
  OverviewClient,
  OverviewPeriod,
  Resource,
  ResourceCounts,
  SetupStep,
  Usage,
  UsageRow,
  Verification,
  VerificationStatus,
  WebsiteInstall,
} from '@/features/agency/types';
import { demoDate } from './fixture-utils';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const ago = (ms: number) => demoDate(-ms).toISOString();
const ymd = (d: Date) => d.toISOString().slice(0, 10);

// ─── The agency ───────────────────────────────────────────────────────────────

export const DEMO_AGENCY_NAME = 'Northwind Digital';
export const DEMO_AGENCY_DOMAIN = 'reports.northwind.agency';

/** The Agency plan's monthly pool. */
export const DEMO_AGENCY_POOL: ResourceCounts = { events: 15_000_000, recordings: 30_000, leads: 200_000, ai_analyses: 1_000 };

// ─── Clients ──────────────────────────────────────────────────────────────────

interface ClientSeed {
  id: string;
  name: string;
  company: string;
  notes: string;
  status: ClientStatus;
  createdDaysAgo: number;
  /** Monthly caps; absent resources draw on the shared pool. */
  caps?: Partial<ResourceCounts>;
  collectOff?: CollectFeature[];
  /** Features that differ from the default matrix. */
  features?: Partial<ClientFeatures>;
}

const CLIENTS: ClientSeed[] = [
  {
    id: 'cl_acme', name: 'Acme Outdoor Co', company: 'Acme Outdoor Co Ltd', status: 'active', createdDaysAgo: 412,
    notes: 'Retainer: monthly performance report on the 1st. Main contact: Jess (ecommerce lead).',
    caps: { events: 2_000_000 },
    features: { revenue: 'edit', funnels: 'edit', goals: 'edit', ai: 'view' },
  },
  {
    id: 'cl_bloom', name: 'Bloom Dental', company: 'Bloom Dental Group', status: 'active', createdDaysAgo: 301,
    notes: 'Three practices. Booking form leads go to reception every morning.',
    collectOff: ['automations'],
    features: { leads: 'edit', recordings: 'off', revenue: 'off', automations: 'off', errors: 'off' },
  },
  {
    id: 'cl_nova', name: 'Nova SaaS', company: 'Nova Software Inc.', status: 'active', createdDaysAgo: 266,
    notes: 'Product-led growth. Weekly sync with their growth team on Tuesdays.',
    features: { events: 'edit', funnels: 'edit', errors: 'edit', ai: 'edit', conversions: 'edit' },
  },
  {
    id: 'cl_harbor', name: 'Harbor Coffee', company: 'Harbor Coffee Roasters', status: 'active', createdDaysAgo: 198,
    notes: 'Small budget: events capped at 300K a month.',
    caps: { events: 300_000 },
    collectOff: ['errors'],
    features: { recordings: 'off', heatmaps: 'view', errors: 'off', ai: 'off', paths: 'off' },
  },
  {
    id: 'cl_peak', name: 'Peak Fitness', company: 'Peak Fitness Clubs', status: 'active', createdDaysAgo: 154,
    notes: 'Membership sign-ups are the goal. Recordings capped while we test the new landing pages.',
    caps: { recordings: 2_000 },
    features: { goals: 'edit', leads: 'edit', automations: 'edit' },
  },
  {
    id: 'cl_lumen', name: 'Lumen Law', company: 'Lumen Law LLP', status: 'active', createdDaysAgo: 120,
    notes: 'Site rebuild in progress on their side; tracking may drop while it moves.',
    collectOff: ['replays', 'heatmaps'],
    features: { recordings: 'off', heatmaps: 'off', revenue: 'off', conversions: 'off', ai: 'off' },
  },
  {
    id: 'cl_verde', name: 'Verde Kitchens', company: 'Verde Kitchens & Interiors', status: 'active', createdDaysAgo: 38,
    notes: 'New client. Showroom microsite launches next month.',
    features: { paths: 'off', errors: 'off', automations: 'off' },
  },
  {
    id: 'cl_old', name: 'Old Client Ltd', company: 'Old Client Ltd', status: 'archived', createdDaysAgo: 640,
    notes: 'Contract ended. Kept for the historical reports.',
    features: { overview: 'view' },
  },
];

// ─── Websites ─────────────────────────────────────────────────────────────────

interface SiteSeed {
  id: string;
  client: string | null;
  name: string;
  host: string;
  tracking: string;
  createdDaysAgo: number;
  /** Visitors, the last 30 days and the 30 before. */
  visitors: [number, number];
  /** This month so far. */
  used: [events: number, recordings: number, leads: number, ai: number];
  install: VerificationStatus;
  /** Inactive: its client is archived. */
  inactive?: boolean;
}

const SITES: SiteSeed[] = [
  { id: 'ws_acme_shop', client: 'cl_acme', name: 'Acme Outdoor shop', host: 'acmeoutdoor.com', tracking: 'ST-4KQ9X2', createdDaysAgo: 410, visitors: [84_200, 76_900], used: [1_180_000, 1_900, 7_000, 60], install: 'receiving' },
  { id: 'ws_acme_blog', client: 'cl_acme', name: 'Acme Journal', host: 'journal.acmeoutdoor.com', tracking: 'ST-7RB2M8', createdDaysAgo: 395, visitors: [21_300, 22_800], used: [260_000, 700, 1_600, 20], install: 'receiving' },
  { id: 'ws_acme_trails', client: 'cl_acme', name: 'Trail finder', host: 'trails.acmeoutdoor.com', tracking: 'ST-2HD6P4', createdDaysAgo: 140, visitors: [12_600, 10_400], used: [180_000, 500, 800, 16], install: 'receiving' },

  { id: 'ws_bloom_main', client: 'cl_bloom', name: 'Bloom Dental', host: 'bloomdental.co.uk', tracking: 'ST-9MW3C1', createdDaysAgo: 300, visitors: [18_400, 17_100], used: [310_000, 650, 2_400, 30], install: 'receiving' },
  { id: 'ws_bloom_book', client: 'cl_bloom', name: 'Online booking', host: 'book.bloomdental.co.uk', tracking: 'ST-5TN8F7', createdDaysAgo: 210, visitors: [6_900, 4_760], used: [95_000, 250, 3_800, 8], install: 'receiving' },

  { id: 'ws_nova_www', client: 'cl_nova', name: 'Nova marketing site', host: 'novasaas.io', tracking: 'ST-3JX7K5', createdDaysAgo: 265, visitors: [52_300, 47_800], used: [720_000, 1_300, 6_200, 60], install: 'receiving' },
  { id: 'ws_nova_app', client: 'cl_nova', name: 'Nova app', host: 'app.novasaas.io', tracking: 'ST-8PL4D9', createdDaysAgo: 262, visitors: [31_800, 23_040], used: [1_050_000, 1_600, 7_400, 50], install: 'receiving' },
  { id: 'ws_nova_docs', client: 'cl_nova', name: 'Nova docs', host: 'docs.novasaas.io', tracking: 'ST-6GV1S3', createdDaysAgo: 250, visitors: [24_100, 22_500], used: [340_000, 600, 900, 20], install: 'receiving' },
  { id: 'ws_nova_careers', client: 'cl_nova', name: 'Nova careers', host: 'careers.novasaas.io', tracking: 'ST-1ZC5H6', createdDaysAgo: 90, visitors: [4_200, 4_900], used: [60_000, 100, 300, 10], install: 'receiving' },

  { id: 'ws_harbor_main', client: 'cl_harbor', name: 'Harbor Coffee', host: 'harborcoffee.com', tracking: 'ST-4YF2R8', createdDaysAgo: 196, visitors: [19_800, 18_600], used: [240_000, 550, 1_500, 18], install: 'receiving' },
  { id: 'ws_harbor_wholesale', client: 'cl_harbor', name: 'Wholesale portal', host: 'wholesale.harborcoffee.com', tracking: 'ST-7KM9B2', createdDaysAgo: 160, visitors: [3_100, 4_080], used: [60_000, 150, 600, 4], install: 'receiving' },

  { id: 'ws_peak_main', client: 'cl_peak', name: 'Peak Fitness', host: 'peakfitness.club', tracking: 'ST-2WQ6T1', createdDaysAgo: 152, visitors: [33_400, 31_200], used: [520_000, 1_000, 4_100, 40], install: 'receiving' },
  { id: 'ws_peak_members', client: 'cl_peak', name: 'Members area', host: 'members.peakfitness.club', tracking: 'ST-9DS3N7', createdDaysAgo: 120, visitors: [9_800, 7_720], used: [210_000, 500, 1_800, 14], install: 'receiving' },

  { id: 'ws_lumen_main', client: 'cl_lumen', name: 'Lumen Law', host: 'lumenlaw.com', tracking: 'ST-5BH8J4', createdDaysAgo: 118, visitors: [4_300, 11_030], used: [145_000, 400, 1_300, 12], install: 'stale' },

  { id: 'ws_verde_main', client: 'cl_verde', name: 'Verde Kitchens', host: 'verdekitchens.com', tracking: 'ST-3RT7W5', createdDaysAgo: 36, visitors: [22_600, 19_900], used: [410_000, 900, 4_700, 30], install: 'receiving' },
  { id: 'ws_verde_showroom', client: 'cl_verde', name: 'Showroom microsite', host: 'showroom.verdekitchens.com', tracking: 'ST-8XN2Q6', createdDaysAgo: 3, visitors: [0, 0], used: [0, 0, 0, 0], install: 'not_seen' },

  { id: 'ws_old_main', client: 'cl_old', name: 'Old Client website', host: 'oldclient.co.uk', tracking: 'ST-6LC4V9', createdDaysAgo: 630, visitors: [600, 900], used: [12_000, 0, 40, 0], install: 'receiving', inactive: true },

  { id: 'ws_northwind', client: null, name: 'Northwind Digital', host: 'northwind.agency', tracking: 'ST-1NW8D3', createdDaysAgo: 700, visitors: [14_200, 12_800], used: [330_000, 750, 1_400, 16], install: 'receiving' },
  { id: 'ws_pitch', client: null, name: 'Pitch sandbox', host: 'pitch.northwind.agency', tracking: 'ST-4PS9K1', createdDaysAgo: 21, visitors: [1_900, 1_300], used: [78_000, 150, 160, 4], install: 'receiving' },
];

// ─── Builders ─────────────────────────────────────────────────────────────────

const RESOURCE_KEYS: Resource[] = ['events', 'recordings', 'leads', 'ai_analyses'];
const zero = (): ResourceCounts => ({ events: 0, recordings: 0, leads: 0, ai_analyses: 0 });
const usedOf = (s: SiteSeed): ResourceCounts => ({ events: s.used[0], recordings: s.used[1], leads: s.used[2], ai_analyses: s.used[3] });
const add = (a: ResourceCounts, b: ResourceCounts): ResourceCounts => ({
  events: a.events + b.events, recordings: a.recordings + b.recordings, leads: a.leads + b.leads, ai_analyses: a.ai_analyses + b.ai_analyses,
});
const sitesOf = (clientId: string | null) => SITES.filter(s => s.client === clientId);

function toWebsite(s: SiteSeed): AgencyWebsite {
  return {
    id: s.id,
    client_id: s.client,
    name: s.name,
    url: `https://${s.host}`,
    tracking_id: s.tracking,
    is_active: !s.inactive,
    is_verified: s.install !== 'not_seen',
    created_at: ago(s.createdDaysAgo * DAY),
    updated_at: ago(Math.min(s.createdDaysAgo, 9) * DAY + 5 * HOUR),
  };
}

function toClient(c: ClientSeed): Client {
  const collect: Record<CollectFeature, boolean> = { analytics: true, heatmaps: true, replays: true, funnels: true, automations: true, errors: true };
  for (const f of c.collectOff ?? []) collect[f] = false;
  return {
    id: c.id,
    name: c.name,
    company: c.company,
    notes: c.notes,
    status: c.status,
    website_count: sitesOf(c.id).length,
    collect_features: collect,
    created_at: ago(c.createdDaysAgo * DAY),
    updated_at: ago((c.status === 'archived' ? 75 : Math.min(c.createdDaysAgo, 12)) * DAY + 3 * HOUR),
  };
}

const FEATURE_DEFAULTS: ClientFeatures = {
  overview: 'view', events: 'view', paths: 'view', revenue: 'view', recordings: 'view', heatmaps: 'view', funnels: 'view',
  goals: 'view', automations: 'off', leads: 'view', conversions: 'off', ai: 'off', errors: 'view', privacy: 'off',
};

function featuresOf(c: ClientSeed): ClientFeatures {
  if (c.status === 'archived') {
    const off = Object.fromEntries(Object.keys(FEATURE_DEFAULTS).map(k => [k, 'off'])) as Record<FeatureId, FeatureAccess>;
    return { ...off, ...c.features };
  }
  return { ...FEATURE_DEFAULTS, ...c.features };
}

function capsOf(c: ClientSeed | undefined): Caps {
  return {
    events: c?.caps?.events ?? null,
    recordings: c?.caps?.recordings ?? null,
    leads: c?.caps?.leads ?? null,
    ai_analyses: c?.caps?.ai_analyses ?? null,
  };
}

function pctOf(used: ResourceCounts, cap: Caps): Caps {
  const out = {} as Caps;
  for (const r of RESOURCE_KEYS) out[r] = cap[r] ? Math.round((used[r] / cap[r]!) * 1000) / 10 : null;
  return out;
}

const page = <T,>(data: T[]): ListResponse<T> => ({ data, page: { next_cursor: null, has_more: false } });

// ─── Public fixtures ──────────────────────────────────────────────────────────

export const demoAgencyClients = (): Client[] => CLIENTS.map(toClient);

export const demoAgencyWebsites = (): AgencyWebsite[] => SITES.map(toWebsite);

export function demoAgencyClient(id: string): ClientDetail | null {
  const seed = CLIENTS.find(c => c.id === id);
  return seed ? { ...toClient(seed), websites: sitesOf(id).map(toWebsite) } : null;
}

export function demoAgencyFeatures(clientId: string): ClientFeatures | null {
  const seed = CLIENTS.find(c => c.id === clientId);
  return seed ? featuresOf(seed) : null;
}

export function demoAgencyBranding(): Branding {
  return {
    brand_name: DEMO_AGENCY_NAME,
    // The workspace previews https logos only; this one does not resolve, so the preview shows
    // the brand's initial on its colour, as it does for any logo that fails to load.
    logo_url: 'https://reports.northwind.agency/brand/northwind-logo.svg',
    primary_color: '#0f766e',
    support_email: 'hello@northwind.agency',
    footer_text: 'Reports by Northwind Digital · northwind.agency',
    hide_seentics: true,
    slug: 'northwind',
    updated_at: ago(6 * DAY + 2 * HOUR),
  };
}

// ─── Client users ─────────────────────────────────────────────────────────────

/** Per client: [name, email local part, status, invited days ago, last seen hours ago or null]. */
const USERS: Record<string, Array<[string, string, ClientUserStatus, number, number | null]>> = {
  cl_acme: [['Jess Morgan', 'jess', 'active', 120, 3], ['Sam Patel', 'sam', 'active', 90, 50], ['Finance team', 'finance', 'invited', 2, null]],
  cl_bloom: [['Dr. Amy Chen', 'amy', 'active', 80, 20], ['Reception', 'reception', 'active', 80, 6]],
  cl_nova: [['Leo Grant', 'leo', 'active', 60, 1], ['Mia Torres', 'mia', 'active', 45, 30], ['Old contractor', 'contractor', 'disabled', 200, 2_000]],
  cl_harbor: [['Tom Reyes', 'tom', 'invited', 5, null]],
  cl_peak: [['Nina Brooks', 'nina', 'active', 40, 12], ['Marketing', 'marketing', 'invited', 1, null]],
  cl_lumen: [['Grace Hall', 'grace', 'active', 30, 70]],
  cl_verde: [['Oscar Diaz', 'oscar', 'invited', 3, null]],
};

const domainOf = (clientId: string) => {
  const site = sitesOf(clientId)[0];
  return site ? site.host.replace(/^www\./, '') : 'example.test';
};

/** The people who sign in to a client's dashboard; `null` for a client not in the demo. */
export function demoAgencyClientUsers(clientId: string): ClientUser[] | null {
  if (!CLIENTS.some(c => c.id === clientId)) return null;
  return (USERS[clientId] ?? []).map(([name, local, status, invitedDays, seenHours], i) => ({
    id: `${clientId}_u${i + 1}`,
    email: `${local}@${domainOf(clientId)}`,
    name,
    status,
    invited_at: ago(invitedDays * DAY),
    last_seen_at: seenHours === null ? null : ago(seenHours * HOUR),
  }));
}

export type DemoDomainState = DomainState | 'none';

/**
 * The custom domain: live by default. `?domain=pending` (or any `DomainState`, or `none`) on a
 * demo page shows the other states, so the set-up screens can be looked at too.
 */
export function demoAgencyDomain(state: DemoDomainState = 'active'): Domain | null {
  if (state === 'none') return null;
  const done = state === 'active';
  return {
    hostname: DEMO_AGENCY_DOMAIN,
    state,
    reason: state === 'failed' ? 'The CNAME record for reports.northwind.agency points to the wrong target.' : null,
    cname_target: 'portal.seentics.com',
    ownership_verification: done ? null : { name: `_cf-custom-hostname.${DEMO_AGENCY_DOMAIN}`, type: 'txt', value: '5d1e8b7a-3c2f-4e19-9a60-2b7f0c4d8e13' },
    created_at: ago((done ? 64 : 0) * DAY + 40 * 60_000),
    updated_at: ago(done ? 63 * DAY : 20 * 60_000),
    last_checked_at: ago(done ? 2 * HOUR : 2 * 60_000),
  };
}

const SCRIPT_URL = 'https://cdn.seentics.com/trackers/tracker.min.js';

export function demoAgencyVerification(websiteId: string): Verification | null {
  const s = SITES.find(x => x.id === websiteId);
  if (!s) return null;
  if (s.install === 'not_seen') return { status: 'not_seen', is_verified: false, last_event_at: null, events_24h: 0 };
  if (s.install === 'stale') return { status: 'stale', is_verified: true, last_event_at: ago(2 * DAY + 7 * HOUR), events_24h: 0 };
  return { status: 'receiving', is_verified: true, last_event_at: ago(3 * 60_000), events_24h: Math.round(s.used[0] / 17) };
}

export function demoAgencyInstall(websiteId: string): WebsiteInstall | null {
  const s = SITES.find(x => x.id === websiteId);
  const verification = demoAgencyVerification(websiteId);
  if (!s || !verification) return null;
  const snippet = `<script async src="${SCRIPT_URL}" data-website-id="${s.id}"></script>`;
  const instructions: Record<InstallMethod, { summary: string; docs_url: string }> = {
    html: { summary: `Paste this tag into the <head> of every page: ${snippet}`, docs_url: 'https://seentics.com/docs/tracker' },
    gtm: { summary: 'In Google Tag Manager, add a Custom HTML tag with the snippet, fired on All Pages, then publish the container.', docs_url: 'https://seentics.com/docs/google-tag-manager' },
    nextjs: { summary: `npm i @seentics/next, then render <Seentics websiteId="${s.id}" /> in the root layout.`, docs_url: 'https://seentics.com/docs/frameworks#nextjs' },
    wordpress: { summary: `Install the Seentics plugin and paste the website ID ${s.id} into its settings.`, docs_url: 'https://seentics.com/docs/wordpress' },
    shopify: { summary: 'Paste the snippet into theme.liquid before </head>, and add the Seentics custom pixel for purchases.', docs_url: 'https://seentics.com/docs/shopify' },
    npm: { summary: `npm i @seentics/react (or vue, nuxt, astro, svelte) and pass websiteId "${s.id}" to its component.`, docs_url: 'https://seentics.com/docs/frameworks' },
  };
  return { website_id: s.id, tracking_id: s.tracking, script_url: SCRIPT_URL, snippet_html: snippet, instructions, verification };
}

export function demoAgencyEmbeds(): Embed[] {
  const make = (id: string, scope: Embed['scope'], targetId: string, targetName: string, sections: Embed['sections'], daysAgo: number): Embed => {
    const token = `emb_${id}`;
    return {
      id, scope, target_id: targetId, target_name: targetName, token,
      embed_url: `https://${DEMO_AGENCY_DOMAIN}/embed/${targetId}?token=${token}${scope === 'client' ? '&client=1' : ''}`,
      sections, created_at: ago(daysAgo * DAY),
    };
  };
  return [
    make('7c2e91a4d0', 'client', 'cl_acme', 'Acme Outdoor Co', ['analytics', 'recordings'], 58),
    make('3f8b06c1e5', 'client', 'cl_peak', 'Peak Fitness', ['analytics', 'heatmaps'], 27),
    make('a91d4e72b8', 'website', 'ws_nova_www', 'Nova marketing site', ['analytics'], 12),
    make('5be0c3f619', 'website', 'ws_bloom_book', 'Online booking', ['analytics', 'heatmaps', 'recordings'], 4),
  ];
}

/** This UTC month, which the pool counts. */
function monthPeriod() {
  const now = demoDate();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

export function demoAgencyUsage(): Usage {
  const used = SITES.reduce((sum, s) => add(sum, usedOf(s)), zero());
  const allocated = zero();
  for (const c of CLIENTS) for (const r of RESOURCE_KEYS) allocated[r] += c.caps?.[r] ?? 0;
  const unallocated = zero();
  const overage = zero();
  for (const r of RESOURCE_KEYS) {
    unallocated[r] = DEMO_AGENCY_POOL[r] - allocated[r];
    overage[r] = Math.max(0, used[r] - DEMO_AGENCY_POOL[r]);
  }
  return { period: monthPeriod(), pool: { ...DEMO_AGENCY_POOL }, used, allocated, unallocated, overage };
}

export function demoAgencyClientUsage(): UsageRow[] {
  return CLIENTS.map(c => {
    const used = sitesOf(c.id).reduce((sum, s) => add(sum, usedOf(s)), zero());
    const cap = capsOf(c);
    return { id: c.id, name: c.name, used, cap, pct: pctOf(used, cap) };
  }).sort((a, b) => b.used.events - a.used.events);
}

export function demoAgencyWebsiteUsage(clientId?: string): UsageRow[] {
  const none = capsOf(undefined);
  return SITES.filter(s => !clientId || s.client === clientId)
    .map(s => ({ id: s.id, name: s.name, used: usedOf(s), cap: none, pct: pctOf(usedOf(s), none), client_id: s.client }))
    .sort((a, b) => b.used.events - a.used.events);
}

// ─── Overview ─────────────────────────────────────────────────────────────────

const PERIOD_DAYS: Record<OverviewPeriod, number> = { '7d': 7, '30d': 30, '90d': 90 };

/** A site's figures over a period: the 30-day visitors scaled, the rest in step with them. */
function siteTotals(s: SiteSeed, days: number, previous: boolean): MetricTotals {
  const visitors = Math.round((previous ? s.visitors[1] : s.visitors[0]) * (days / 30));
  const ratio = s.visitors[0] ? visitors / s.visitors[0] : 0;
  const monthly = (n: number) => Math.round(n * 1.75 * ratio);
  return {
    visitors,
    pageviews: Math.round(visitors * 2.9),
    events: monthly(s.used[0]),
    recordings: monthly(s.used[1]),
    leads: monthly(s.used[2]),
    conversions: Math.round(monthly(s.used[2]) * 0.34),
  };
}

function sumTotals(list: MetricTotals[]): MetricTotals {
  const out: Required<Pick<MetricTotals, 'visitors' | 'pageviews' | 'events' | 'recordings' | 'leads' | 'conversions'>> = {
    visitors: 0, pageviews: 0, events: 0, recordings: 0, leads: 0, conversions: 0,
  };
  for (const t of list) for (const k of Object.keys(out) as Array<keyof typeof out>) out[k] += t[k] ?? 0;
  return out;
}

export function demoAgencyAlerts(): AgencyAlert[] {
  const today = ymd(demoDate());
  return [
    { id: 'al_acme_cap80', kind: 'cap_80', client_id: 'cl_acme', website_id: null, resource: 'events', period: today, created_at: ago(9 * HOUR), dismissed_at: null },
    { id: 'al_lumen_stopped', kind: 'tracking_stopped', client_id: 'cl_lumen', website_id: 'ws_lumen_main', resource: 'events', period: today, created_at: ago(26 * HOUR), dismissed_at: null },
    { id: 'al_harbor_cap100', kind: 'cap_100', client_id: 'cl_harbor', website_id: null, resource: 'events', period: today, created_at: ago(3 * DAY + 4 * HOUR), dismissed_at: null },
  ];
}

export function demoAgencyOverview(period: string = '30d'): Overview {
  const key: OverviewPeriod = period === '7d' || period === '90d' ? period : '30d';
  const days = PERIOD_DAYS[key];
  const end = demoDate();
  const start = demoDate(-(days - 1) * DAY);
  const previousEnd = demoDate(-days * DAY);
  const previousStart = demoDate(-(2 * days - 1) * DAY);

  const row = (id: string | null, name: string, status: ClientStatus | null): OverviewClient => {
    const sites = sitesOf(id);
    return {
      id, name, status, website_count: sites.length,
      totals: sumTotals(sites.map(s => siteTotals(s, days, false))),
      previous_totals: sumTotals(sites.map(s => siteTotals(s, days, true))),
    };
  };
  const clients = [...CLIENTS.map(c => row(c.id, c.name, c.status)), row(null, 'Not assigned', null)];

  const movers: Mover[] = SITES.filter(s => s.visitors[1] >= 2_000)
    .map(s => {
      const current = Math.round(s.visitors[0] * (days / 30));
      const previous = Math.round(s.visitors[1] * (days / 30));
      return {
        website_id: s.id, website_name: s.name, client_id: s.client, metric: 'visitors' as const,
        current, previous, change_pct: Math.round(((current - previous) / previous) * 1000) / 10,
      };
    })
    .sort((a, b) => Math.abs(b.change_pct ?? 0) - Math.abs(a.change_pct ?? 0))
    .slice(0, 5);

  return {
    period: { key, start: ymd(start), end: ymd(end), previous_start: ymd(previousStart), previous_end: ymd(previousEnd) },
    totals: sumTotals(clients.map(c => c.totals)),
    previous_totals: sumTotals(clients.map(c => c.previous_totals)),
    clients,
    top_movers: movers,
    alerts: demoAgencyAlerts(),
    generated_at: ago(4 * 60_000),
  };
}

/** Every step done: the demo agency has clients signing in already. */
export function demoAgencySetup(): SetupStep[] {
  return [
    { id: 'branding', done: true },
    { id: 'first_client', done: true },
    { id: 'website_installed', done: true },
    { id: 'client_user', done: true },
    { id: 'features_limits', done: true },
  ];
}

// ─── The API, answered ────────────────────────────────────────────────────────

export interface DemoAgencyRequest {
  params?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** `?domain=` on the demo page: which custom-domain state to show. */
  domainState?: DemoDomainState;
}

/** A 404 shaped like the agency API's error envelope, so `errorMessage` reads it as usual. */
export class DemoAgencyNotFound extends Error {
  response: { status: number; data: { error: { code: string; message: string } } };
  constructor(what: string) {
    super(`${what} not found`);
    this.response = { status: 404, data: { error: { code: 'not_found', message: `That ${what} is not in the demo.` } } };
  }
}

const text = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : '');
const matches = (q: string, ...fields: string[]) => !q || fields.some(f => f.toLowerCase().includes(q));

/**
 * The body `GET <path>` would answer, for a read from `features/agency/api.ts`. Writes never get
 * here: the demo refuses them before they are sent.
 */
export function demoAgencyResponse(path: string, req: DemoAgencyRequest = {}): unknown {
  const id = req.params?.id ?? '';
  const query = req.query ?? {};
  switch (path) {
    case '/agency/overview':
      return { data: demoAgencyOverview(typeof query.period === 'string' ? query.period : '30d') };
    case '/agency/setup':
      return { data: { steps: demoAgencySetup() } };
    case '/agency/clients': {
      const q = text(query.q);
      return page(demoAgencyClients().filter(c => (!query.status || c.status === query.status) && matches(q, c.name, c.company)));
    }
    case '/agency/clients/:id': {
      const client = demoAgencyClient(id);
      if (!client) throw new DemoAgencyNotFound('client');
      return { data: client };
    }
    case '/agency/clients/:id/websites':
      return page(demoAgencyWebsites().filter(w => w.client_id === id));
    case '/agency/clients/:id/users': {
      const users = demoAgencyClientUsers(id);
      if (!users) throw new DemoAgencyNotFound('client');
      return page(users);
    }
    case '/agency/clients/:id/features': {
      const features = demoAgencyFeatures(id);
      if (!features) throw new DemoAgencyNotFound('client');
      return { data: { features } };
    }
    case '/agency/websites': {
      const q = text(query.q);
      const unassigned = query.unassigned === true || query.unassigned === 'true';
      return page(demoAgencyWebsites().filter(w =>
        (!query.client_id || w.client_id === query.client_id) && (!unassigned || w.client_id === null) && matches(q, w.name, w.url)));
    }
    case '/agency/websites/:id': {
      const site = demoAgencyWebsites().find(w => w.id === id);
      if (!site) throw new DemoAgencyNotFound('website');
      return { data: site };
    }
    case '/agency/websites/:id/install': {
      const install = demoAgencyInstall(id);
      if (!install) throw new DemoAgencyNotFound('website');
      return { data: install };
    }
    case '/agency/branding':
      return { data: demoAgencyBranding() };
    case '/agency/domain':
      return { data: demoAgencyDomain(req.domainState) };
    case '/agency/embeds':
      return page(demoAgencyEmbeds().filter(e => (!query.scope || e.scope === query.scope) && (!query.target_id || e.target_id === query.target_id)));
    case '/agency/usage':
      return { data: demoAgencyUsage() };
    case '/agency/usage/clients':
      return page(demoAgencyClientUsage());
    case '/agency/usage/websites':
      return page(demoAgencyWebsiteUsage(typeof query.client_id === 'string' ? query.client_id : undefined));
    default:
      throw new DemoAgencyNotFound('page');
  }
}
