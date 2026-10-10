/**
 * Demo data for the agency page: an agency running six client accounts.
 *
 * Chosen to show every state the page draws: an archived and a suspended client, a
 * client with recordings switched off, uncapped and capped clients, and one with
 * several sites.
 */
import type { AgencyAPIKey, AgencyClient, ClientUser, EmbedLink, WhiteLabelSettings, AgencyClientFeatures, ClientLimits, ClientWebsite } from '@/features/agency/types';
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

export const demoAgencyKeys = (): AgencyAPIKey[] => [
  {
    id: 'demo-key-1',
    name: 'Client onboarding (production)',
    keyPrefix: 'snt_acct_Q7vX2m',
    scopes: ['websites:read', 'websites:write', 'analytics:read', 'replays:read', 'heatmaps:read'],
    lastUsed: ago(2 * 60 * 60 * 1000),
    createdAt: ago(90 * DAY),
  },
  {
    id: 'demo-key-2',
    name: 'Reporting dashboard',
    keyPrefix: 'snt_acct_b4KpR9',
    scopes: ['websites:read', 'analytics:read'],
    lastUsed: ago(3 * DAY),
    createdAt: ago(40 * DAY),
  },
];

/** Client logins: people at the demo clients who can see only their own dashboard. */
export const demoClientUsers = (): ClientUser[] => {
  const user = (
    n: number, name: string, email: string, company: string, status: ClientUser['status'],
    daysAgo: number, off: Array<keyof ClientUser['featuresEnabled']> = [],
  ): ClientUser => ({
    id: `demo-client-user-${n}`,
    userId: `demo-user-${n}`,
    name, email, company, status,
    featuresEnabled: {
      analytics: true, heatmaps: true, replays: true, funnels: true, automations: true,
      ...Object.fromEntries(off.map(k => [k, false])),
    },
    createdAt: demoDate(-daysAgo * DAY).toISOString(),
  });
  return [
    user(1, 'Maya Chen', 'ops@northwind.coffee', 'Northwind Coffee', 'active', 96),
    user(2, 'Priya Nair', 'hello@bloomandco.com', 'Bloom & Co', 'active', 61, ['replays']),
    user(3, 'Tom Becker', 'digital@atlasfitness.io', 'Atlas Fitness', 'active', 34),
    user(4, 'Sara Lindqvist', 'admin@harbordental.co', 'Harbor Dental', 'suspended', 22, ['funnels', 'automations']),
  ];
};

/** The agency's own branding, as its clients see it. */
export const demoWhiteLabel = (): WhiteLabelSettings => ({
  userId: 'demo-user',
  brandName: 'Meridian Digital',
  logoUrl: '',
  primaryColor: '#7c3aed',
  supportEmail: 'support@meridian.agency',
  customDomain: 'analytics.meridian.agency',
  hideSeentics: true,
});

/**
 * Embed links on the demo site. The token is the word "demo", which the embed page reads as
 * "show sample data"; the URLs are paths, resolved against the page's own origin.
 */
export const demoEmbedLinks = (): EmbedLink[] => [
  {
    id: 'demo-embed-1', scope: 'website', targetId: 'demo', targetName: 'Seentics Production',
    token: 'demo', embedUrl: '/embed/demo?token=demo', sections: ['analytics', 'recordings', 'heatmaps'], createdAt: demoDate(-21 * DAY).toISOString(),
  },
  {
    id: 'demo-embed-2', scope: 'client', targetId: 'northwind', targetName: 'Northwind Coffee',
    token: 'demo-analytics', embedUrl: '/embed/northwind?token=demo-analytics&client=1', sections: ['analytics'], createdAt: demoDate(-9 * DAY).toISOString(),
  },
];
