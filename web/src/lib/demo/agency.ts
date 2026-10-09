/**
 * Demo data for the agency page: an agency running six client accounts.
 *
 * Chosen to show every state the page draws: an archived and a suspended client, a
 * client with recordings switched off, uncapped and capped clients, and one with
 * several sites.
 */
import type { AgencyAPIKey, AgencyClient, AgencyClientFeatures, ClientLimits, ClientWebsite } from '@/features/agency/types';
import type { ApiKey } from '@/features/api-keys/types';
import { createDemoRandom, demoDate } from './fixture-utils';

const DAY = 24 * 60 * 60 * 1000;
const ALL_ON: AgencyClientFeatures = {
  analytics: true, heatmaps: true, replays: true, funnels: true, automations: true, errors: true,
};
const NO_CAPS: ClientLimits = { maxWebsites: null, maxMonthlyEvents: null, maxReplays: null, maxHeatmaps: null };

function site(clientId: string, n: number, name: string, url: string, daysAgo: number): ClientWebsite {
  const id = `demo-${clientId}-site-${n}`;
  return {
    id,
    clientId,
    name,
    url,
    trackingId: `ST-${clientId.slice(0, 4).toUpperCase()}${n}`,
    isActive: true,
    snippet: `<script defer data-website-id="${id}" src="https://seentics.com/trackers/seentics.min.js"></script>`,
    createdAt: demoDate(-daysAgo * DAY).toISOString(),
  };
}

function client(
  id: string,
  fields: Partial<AgencyClient> & Pick<AgencyClient, 'name'>,
  daysAgo: number,
): AgencyClient {
  return {
    id,
    externalId: null,
    company: '',
    email: '',
    websiteUrl: '',
    status: 'active',
    note: '',
    featuresEnabled: ALL_ON,
    limits: NO_CAPS,
    metadata: {},
    websites: [],
    createdAt: demoDate(-daysAgo * DAY).toISOString(),
    updatedAt: demoDate(-Math.min(daysAgo, 3) * DAY).toISOString(),
    ...fields,
  };
}

export const demoAgencyClients = (): AgencyClient[] => [
  client('northwind', {
    name: 'Northwind Coffee',
    company: 'Northwind Roasters Ltd',
    email: 'ops@northwind.coffee',
    externalId: 'acct_1042',
    limits: { ...NO_CAPS, maxMonthlyEvents: 250_000, maxReplays: 2_000 },
    websites: [
      site('northwind', 1, 'Northwind Shop', 'shop.northwind.coffee', 210),
      site('northwind', 2, 'Northwind Blog', 'blog.northwind.coffee', 160),
      site('northwind', 3, 'Wholesale portal', 'trade.northwind.coffee', 45),
    ],
  }, 214),
  client('bloom', {
    name: 'Bloom & Co',
    company: 'Bloom & Co Florists',
    email: 'hello@bloomandco.com',
    externalId: 'acct_1077',
    featuresEnabled: { ...ALL_ON, replays: false },
    limits: { ...NO_CAPS, maxMonthlyEvents: 50_000 },
    note: 'Recordings off until their privacy review signs off.',
    websites: [site('bloom', 1, 'Bloom & Co', 'bloomandco.com', 120)],
  }, 122),
  client('atlas', {
    name: 'Atlas Fitness',
    company: 'Atlas Gyms Group',
    email: 'digital@atlasfitness.io',
    externalId: 'acct_1103',
    limits: { maxWebsites: 5, maxMonthlyEvents: 500_000, maxReplays: 5_000, maxHeatmaps: 40 },
    websites: [
      site('atlas', 1, 'Atlas Fitness', 'atlasfitness.io', 98),
      site('atlas', 2, 'Class booking', 'book.atlasfitness.io', 98),
    ],
  }, 98),
  client('harbor', {
    name: 'Harbor Dental',
    company: 'Harbor Dental Clinics',
    email: 'admin@harbordental.co',
    externalId: 'acct_1118',
    featuresEnabled: { ...ALL_ON, automations: false, funnels: false },
    limits: { ...NO_CAPS, maxMonthlyEvents: 20_000, maxReplays: 150 },
    websites: [site('harbor', 1, 'Harbor Dental', 'harbordental.co', 64)],
  }, 64),
  client('pixel', {
    name: 'Pixel Pet Supplies',
    company: 'Pixel Pets Inc.',
    email: 'web@pixelpets.shop',
    externalId: 'acct_1126',
    status: 'suspended',
    limits: { ...NO_CAPS, maxMonthlyEvents: 100_000, maxReplays: 100 },
    note: 'Invoice overdue — collection paused.',
    websites: [site('pixel', 1, 'Pixel Pets', 'pixelpets.shop', 41)],
  }, 41),
  client('summit', {
    name: 'Summit Realty',
    company: 'Summit Realty Partners',
    email: 'marketing@summitrealty.com',
    externalId: 'acct_0987',
    status: 'archived',
    websites: [site('summit', 1, 'Summit Listings', 'listings.summitrealty.com', 300)],
  }, 300),
];

/**
 * Key timestamps are relative to the real now, not the fixed demo clock: they are shown as
 * "used 2 hours ago", and against the frozen 2025 clock every key read "over a year ago".
 */
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

/** The demo website's own read-only data-API keys. */
export const demoWebsiteKeys = (): ApiKey[] => [
  {
    id: 'demo-site-key-1',
    name: 'Looker Studio sync',
    prefix: 'snt_demo00_7Hq2',
    scopes: ['analytics:read'],
    created_at: ago(60 * DAY),
    last_used_at: ago(5 * 60 * 60 * 1000),
  },
  {
    id: 'demo-site-key-2',
    name: 'Support tool — replays',
    prefix: 'snt_demo00_Lm8c',
    scopes: ['replays:read', 'heatmaps:read'],
    created_at: ago(12 * DAY),
    last_used_at: null,
  },
];

/**
 * What `/embed/demo` shows: the embed summary's exact shape (core `app/http/embed`), with
 * a gently varying 30-day series from the seeded demo generator.
 */
export function demoEmbedSummary(days: number) {
  const rand = createDemoRandom(`embed-${days}`);
  // Relative to the real today: the embed fills its window up to today, so a series on the
  // frozen demo clock would fall entirely outside it.
  const daily = Array.from({ length: days }, (_, i) => {
    const date = ago((days - 1 - i) * DAY).slice(0, 10);
    const weekday = new Date(date).getUTCDay();
    const base = (weekday === 0 || weekday === 6 ? 310 : 460) + i * 3;
    const views = Math.round(base * (0.85 + rand() * 0.3));
    return { date, views, unique: Math.round(views * (0.58 + rand() * 0.06)) };
  });
  const pageViews = daily.reduce((n, d) => n + d.views, 0);
  const visitors = daily.reduce((n, d) => n + d.unique, 0);
  const row = <K extends string>(key: K, rows: [string, number][]) =>
    rows.map(([name, share]) => ({ [key]: name, views: Math.round(pageViews * share), unique: Math.round(visitors * share) })) as
      Array<Record<K, string> & { views: number; unique: number }>;

  return {
    website: { name: 'Northwind Coffee', url: 'shop.northwind.coffee' },
    days,
    dashboard: {
      total_visitors: visitors, unique_visitors: visitors, page_views: pageViews, sessions: Math.round(visitors * 1.18),
      bounce_rate: 38.4, session_duration: 154, live_visitors: 7,
      comparison: { visitor_change: 12.6, pageview_change: 9.1, bounce_change: -2.3, duration_change: 4.8 },
    },
    daily: { daily_stats: daily },
    top_pages: { top_pages: row('page', [['/', 0.31], ['/menu', 0.19], ['/order', 0.14], ['/locations', 0.09], ['/about', 0.05]]) },
    top_referrers: { top_referrers: row('referrer', [['google.com', 0.42], ['direct', 0.27], ['instagram.com', 0.12], ['yelp.com', 0.06]]) },
    top_countries: { top_countries: row('country', [['US', 0.61], ['CA', 0.14], ['GB', 0.09], ['AU', 0.05]]) },
    top_devices: { top_devices: row('device', [['Mobile', 0.64], ['Desktop', 0.31], ['Tablet', 0.05]]) },
  };
}

export const demoAgencyKeys = (): AgencyAPIKey[] => [
  {
    id: 'demo-key-1',
    name: 'Client onboarding (production)',
    keyPrefix: 'snt_acct_Q7vX2m',
    scopes: ['websites:read', 'websites:write'],
    lastUsed: ago(2 * 60 * 60 * 1000),
    createdAt: ago(90 * DAY),
  },
  {
    id: 'demo-key-2',
    name: 'Reporting dashboard',
    keyPrefix: 'snt_acct_b4KpR9',
    scopes: ['websites:read'],
    lastUsed: ago(3 * DAY),
    createdAt: ago(40 * DAY),
  },
];
