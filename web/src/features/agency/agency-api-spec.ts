/**
 * The agency API (`/api/v1/agency/*`), endpoint by endpoint: the source of the workspace's API
 * page, its curl and Node examples, and the parity test that fails when `api.ts` calls a path
 * that is not here. When an endpoint changes, change it here in the same commit.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type AgencyScope = 'agency:read' | 'agency:write';

export interface SpecField {
  name: string;
  type: string;
  required?: boolean;
  description: string;
}

export interface AgencyEndpoint {
  id: string;
  group: string;
  method: HttpMethod;
  /** As the API documents it, without the `/api/v1` base: `/agency/clients/:id`. */
  path: string;
  summary: string;
  description?: string;
  'x-scope': AgencyScope;
  pathParams?: SpecField[];
  query?: SpecField[];
  body?: SpecField[];
  /** Example values for the path parameters and query, used by the generated examples. */
  example?: { params?: Record<string, string>; query?: Record<string, string> };
  requestExample?: unknown;
  responseExample: unknown;
  /** Response status when not 200. */
  status?: number;
}

export const AGENCY_API_BASE = 'https://api.seentics.com/api/v1';

const CLIENT_ID = '5bbeaa88-b089-4923-ad54-8fdcbbcdba94';
const SITE_ID = '2f60eb30-722c-4fbf-8afa-99fe0e67f6d9';
const EMBED_ID = '9a1f3c52-0d6e-4c1b-8b7e-2c4b3f0e1d77';
const ALERT_ID = 'c0b5d1e2-7a44-4f0e-9b1a-3d2e6f8a9b10';
const SCRIPT = 'https://seentics.com/trackers/seentics.min.js';
const SNIPPET = `<script defer data-website-id="${SITE_ID}" src="${SCRIPT}"></script>`;
const page = (next: string | null = null) => ({ next_cursor: next, has_more: next !== null });
const counts = (events: number, recordings: number, leads: number, ai: number) => ({ events, recordings, leads, ai_analyses: ai });

const client = {
  id: CLIENT_ID,
  name: 'Acme Bakery',
  company: 'Acme Bakery Ltd',
  notes: '',
  status: 'active',
  website_count: 1,
  collect_features: { analytics: true, heatmaps: true, replays: true, funnels: true, automations: true, errors: true },
  created_at: '2026-10-09T07:50:21.158Z',
  updated_at: '2026-10-09T07:50:21.158Z',
};

const website = {
  id: SITE_ID,
  client_id: CLIENT_ID,
  name: 'Acme Bakery',
  url: 'https://acmebakery.test',
  tracking_id: 'ST-76d3842a9594c586',
  is_active: true,
  is_verified: true,
  created_at: '2026-10-09T07:52:33.324Z',
  updated_at: '2026-10-09T07:52:33.324Z',
};

const verification = { status: 'receiving', is_verified: true, last_event_at: '2026-10-16T22:41:07.000Z', events_24h: 1824 };

const install = {
  website_id: SITE_ID,
  tracking_id: 'ST-76d3842a9594c586',
  script_url: SCRIPT,
  snippet_html: SNIPPET,
  instructions: {
    html: { summary: `Paste this tag into the <head> of every page: ${SNIPPET}`, docs_url: 'https://seentics.com/docs/tracker' },
    gtm: { summary: 'In Google Tag Manager, add a Custom HTML tag with the snippet, fired on All Pages, then publish the container.', docs_url: 'https://seentics.com/docs/google-tag-manager' },
    nextjs: { summary: `npm i @seentics/next, then render <Seentics websiteId="${SITE_ID}" /> in the root layout.`, docs_url: 'https://seentics.com/docs/frameworks#nextjs' },
    wordpress: { summary: `Install the Seentics plugin and paste the website ID ${SITE_ID} into its settings.`, docs_url: 'https://seentics.com/docs/wordpress' },
    shopify: { summary: 'Paste the snippet into theme.liquid before </head>, and add the Seentics custom pixel for purchases.', docs_url: 'https://seentics.com/docs/shopify' },
    npm: { summary: `npm i @seentics/react (or vue, nuxt, astro, svelte) and pass websiteId "${SITE_ID}" to its component.`, docs_url: 'https://seentics.com/docs/frameworks' },
  },
  verification,
};

const features = {
  overview: 'view', events: 'view', paths: 'view', revenue: 'off', recordings: 'off', heatmaps: 'view', funnels: 'view',
  goals: 'edit', automations: 'off', leads: 'off', conversions: 'off', ai: 'off', errors: 'off', privacy: 'view',
};

const branding = {
  brand_name: 'Meridian Digital',
  logo_url: 'https://cdn.meridian.test/logo.png',
  primary_color: '#7c3aed',
  support_email: 'help@meridian.test',
  footer_text: 'Reports by Meridian Digital',
  hide_seentics: true,
  slug: 'meridian',
  updated_at: '2026-10-12T10:00:00.000Z',
};

const domain = {
  hostname: 'reports.meridian.test',
  state: 'pending_dns',
  reason: null,
  cname_target: 'portal.seentics.com',
  ownership_verification: { name: '_cf-custom-hostname.reports.meridian.test', type: 'txt', value: '7f3a9c1e-…' },
  created_at: '2026-10-12T10:00:00.000Z',
  updated_at: '2026-10-12T10:00:00.000Z',
  last_checked_at: '2026-10-12T10:05:00.000Z',
};

const embed = {
  id: EMBED_ID,
  scope: 'client',
  target_id: CLIENT_ID,
  target_name: 'Acme Bakery',
  token: 'emb_4b7c0e9f2a',
  embed_url: `https://seentics.com/embed/${SITE_ID}?token=emb_4b7c0e9f2a&client=1`,
  sections: ['analytics'],
  created_at: '2026-10-12T10:00:00.000Z',
};

const usage = {
  period: { start: '2026-10-01T00:00:00.000Z', end: '2026-11-01T00:00:00.000Z' },
  pool: counts(5_000_000, 50_000, 10_000, 1_000),
  used: counts(1_240_512, 8_204, 312, 41),
  allocated: counts(0, 0, 0, 0),
  unallocated: counts(5_000_000, 50_000, 10_000, 1_000),
  overage: counts(0, 0, 0, 0),
};

const noCaps = { events: null, recordings: null, leads: null, ai_analyses: null };
const usageRow = { id: CLIENT_ID, name: 'Acme Bakery', used: counts(412_000, 2_100, 88, 12), cap: noCaps, pct: noCaps };

const clientFields: SpecField[] = [
  { name: 'name', type: 'string', required: true, description: 'Client name, 1–120 characters.' },
  { name: 'company', type: 'string', description: 'Company name, up to 200 characters.' },
  { name: 'notes', type: 'string', description: 'Private notes, up to 2000 characters.' },
];

const websiteFields: SpecField[] = [
  { name: 'name', type: 'string', required: true, description: 'Website name.' },
  { name: 'url', type: 'string', required: true, description: 'The site’s address.' },
];

/** Usage is per UTC month, all rows in one page; caps are not allocated yet, so `cap` and `pct` are `null`. */
const monthQuery: SpecField[] = [{ name: 'month', type: 'string', description: '`YYYY-MM`; default the current UTC month.' }];

const idParam = (what: string): SpecField[] => [{ name: 'id', type: 'uuid', required: true, description: `The ${what}’s ID.` }];
const pagination: SpecField[] = [
  { name: 'limit', type: 'integer', description: 'Up to 100 rows; default 25.' },
  { name: 'cursor', type: 'string', description: 'The `next_cursor` of the previous page.' },
];

export const AGENCY_API: AgencyEndpoint[] = [
  // ─── Overview ─────────────────────────────────────────────────────────────
  {
    id: 'overview', group: 'Overview', method: 'GET', path: '/agency/overview', 'x-scope': 'agency:read',
    summary: 'Totals, per-client trends, top movers and alerts',
    query: [{ name: 'period', type: 'string', description: '`7d`, `30d` or `90d`; default `30d`.' }],
    example: { query: { period: '30d' } },
    responseExample: {
      data: {
        period: { key: '30d', start: '2026-09-17', end: '2026-10-16', previous_start: '2026-08-18', previous_end: '2026-09-16' },
        totals: { visitors: 48_210, pageviews: 131_004, events: 412_000, recordings: 2_100, leads: 88 },
        previous_totals: { visitors: 42_890, pageviews: 120_310, events: 380_200, recordings: 1_950, leads: 71 },
        clients: [{
          id: CLIENT_ID, name: 'Acme Bakery', status: 'active', website_count: 1,
          totals: { visitors: 48_210, events: 412_000, leads: 88 }, previous_totals: { visitors: 42_890, events: 380_200, leads: 71 },
        }],
        top_movers: [{
          website_id: SITE_ID, website_name: 'Acme Bakery', client_id: CLIENT_ID, metric: 'visitors',
          current: 48_210, previous: 42_890, change_pct: 12.4,
        }],
        alerts: [{
          id: ALERT_ID, kind: 'tracking_stopped', client_id: CLIENT_ID, website_id: SITE_ID, resource: 'events',
          period: '2026-10-16', created_at: '2026-10-16T06:00:00.000Z', dismissed_at: null,
        }],
        generated_at: '2026-10-17T09:00:00.000Z',
      },
    },
  },
  {
    id: 'dismiss-alert', group: 'Overview', method: 'POST', path: '/agency/alerts/:id/dismiss', 'x-scope': 'agency:write',
    summary: 'Dismiss an alert',
    pathParams: idParam('alert'), example: { params: { id: ALERT_ID } },
    responseExample: {
      data: {
        id: ALERT_ID, kind: 'tracking_stopped', client_id: CLIENT_ID, website_id: SITE_ID, resource: 'events',
        period: '2026-10-16', created_at: '2026-10-16T06:00:00.000Z', dismissed_at: '2026-10-17T09:00:00.000Z',
      },
    },
  },
  {
    id: 'setup', group: 'Overview', method: 'GET', path: '/agency/setup', 'x-scope': 'agency:read',
    summary: 'Setup guide progress',
    responseExample: {
      data: {
        steps: [
          { id: 'branding', done: true }, { id: 'first_client', done: true }, { id: 'website_installed', done: false },
          { id: 'client_user', done: false }, { id: 'features_limits', done: false },
        ],
      },
    },
  },

  // ─── Clients ──────────────────────────────────────────────────────────────
  {
    id: 'list-clients', group: 'Clients', method: 'GET', path: '/agency/clients', 'x-scope': 'agency:read',
    summary: 'List clients',
    query: [
      { name: 'status', type: '"active" | "suspended" | "archived"', description: 'Only clients in this status.' },
      { name: 'q', type: 'string', description: 'Search name and company.' },
      ...pagination,
    ],
    example: { query: { status: 'active' } },
    responseExample: { data: [client], page: page() },
  },
  {
    id: 'create-client', group: 'Clients', method: 'POST', path: '/agency/clients', 'x-scope': 'agency:write',
    summary: 'Create a client', status: 201,
    body: clientFields,
    requestExample: { name: 'Acme Bakery', company: 'Acme Bakery Ltd' },
    responseExample: { data: { ...client, website_count: 0, websites: [] } },
  },
  {
    id: 'get-client', group: 'Clients', method: 'GET', path: '/agency/clients/:id', 'x-scope': 'agency:read',
    summary: 'Get a client with its websites', pathParams: idParam('client'), example: { params: { id: CLIENT_ID } },
    responseExample: { data: { ...client, websites: [website] } },
  },
  {
    id: 'update-client', group: 'Clients', method: 'PATCH', path: '/agency/clients/:id', 'x-scope': 'agency:write',
    summary: 'Update a client', description: 'Absent fields keep their value.',
    pathParams: idParam('client'),
    body: [
      ...clientFields.map(f => ({ ...f, required: false })),
      { name: 'status', type: '"active" | "suspended" | "archived"', description: 'Anything but `active` stops its websites collecting.' },
      { name: 'collect_features', type: 'Record<"analytics" | "heatmaps" | "replays" | "funnels" | "automations" | "errors", boolean>', description: 'What its websites collect; `analytics: false` stops collection entirely.' },
    ],
    example: { params: { id: CLIENT_ID } },
    requestExample: { notes: 'Renews in March' },
    responseExample: { data: { ...client, notes: 'Renews in March', websites: [website] } },
  },
  {
    id: 'archive-client', group: 'Clients', method: 'POST', path: '/agency/clients/:id/archive', 'x-scope': 'agency:write',
    summary: 'Archive a client', description: 'Its websites stop collecting until it is restored.',
    pathParams: idParam('client'), example: { params: { id: CLIENT_ID } },
    responseExample: { data: { ...client, status: 'archived', websites: [website] } },
  },
  {
    id: 'unarchive-client', group: 'Clients', method: 'POST', path: '/agency/clients/:id/unarchive', 'x-scope': 'agency:write',
    summary: 'Restore an archived client', pathParams: idParam('client'), example: { params: { id: CLIENT_ID } },
    responseExample: { data: { ...client, websites: [website] } },
  },
  {
    id: 'delete-client', group: 'Clients', method: 'DELETE', path: '/agency/clients/:id', 'x-scope': 'agency:write',
    summary: 'Delete a client', description: 'Requires `confirm=true`. Its websites stay in your account, no longer assigned.',
    pathParams: idParam('client'),
    query: [{ name: 'confirm', type: 'boolean', required: true, description: 'Must be `true`.' }],
    example: { params: { id: CLIENT_ID }, query: { confirm: 'true' } },
    status: 204, responseExample: null,
  },
  {
    id: 'list-client-websites', group: 'Clients', method: 'GET', path: '/agency/clients/:id/websites', 'x-scope': 'agency:read',
    summary: 'List a client’s websites', pathParams: idParam('client'), query: pagination, example: { params: { id: CLIENT_ID } },
    responseExample: { data: [website], page: page() },
  },
  {
    id: 'add-client-website', group: 'Clients', method: 'POST', path: '/agency/clients/:id/websites', 'x-scope': 'agency:write',
    summary: 'Add a website to a client', description: 'Answers with the website and its install snippet.', status: 201,
    pathParams: idParam('client'), body: websiteFields, example: { params: { id: CLIENT_ID } },
    requestExample: { name: 'Acme Bakery', url: 'https://acmebakery.test' },
    responseExample: {
      data: {
        website: { ...website, is_verified: false },
        install: { ...install, verification: { status: 'not_seen', is_verified: false, last_event_at: null, events_24h: 0 } },
      },
    },
  },
  {
    id: 'get-client-features', group: 'Clients', method: 'GET', path: '/agency/clients/:id/features', 'x-scope': 'agency:read',
    summary: 'Dashboard pages the client can see', pathParams: idParam('client'), example: { params: { id: CLIENT_ID } },
    responseExample: { data: { features } },
  },
  {
    id: 'set-client-features', group: 'Clients', method: 'PUT', path: '/agency/clients/:id/features', 'x-scope': 'agency:write',
    summary: 'Set which dashboard pages the client can see',
    description: 'Each feature is `off`, `view` or `edit`; a feature left out is `off`. Enforced once client sign-in is available.',
    pathParams: idParam('client'),
    body: [{ name: 'features', type: 'Record<feature, "off" | "view" | "edit">', required: true, description: 'Every feature id.' }],
    example: { params: { id: CLIENT_ID } },
    requestExample: { features },
    responseExample: { data: { features } },
  },

  // ─── Websites ─────────────────────────────────────────────────────────────
  {
    id: 'list-websites', group: 'Websites', method: 'GET', path: '/agency/websites', 'x-scope': 'agency:read',
    summary: 'List websites',
    query: [
      { name: 'client_id', type: 'uuid', description: 'Only this client’s websites.' },
      { name: 'unassigned', type: 'boolean', description: '`true` for websites with no client.' },
      { name: 'q', type: 'string', description: 'Search name and URL.' },
      ...pagination,
    ],
    example: { query: { unassigned: 'true' } },
    responseExample: { data: [website], page: page() },
  },
  {
    id: 'create-website', group: 'Websites', method: 'POST', path: '/agency/websites', 'x-scope': 'agency:write',
    summary: 'Create a website', description: 'Read its snippet from `GET /agency/websites/:id/install`.', status: 201,
    body: [...websiteFields, { name: 'client_id', type: 'uuid | null', description: 'The client to put it under.' }],
    requestExample: { name: 'Acme Bakery', url: 'https://acmebakery.test', client_id: CLIENT_ID },
    responseExample: { data: { ...website, is_verified: false } },
  },
  {
    id: 'get-website', group: 'Websites', method: 'GET', path: '/agency/websites/:id', 'x-scope': 'agency:read',
    summary: 'Get a website', pathParams: idParam('website'), example: { params: { id: SITE_ID } },
    responseExample: { data: website },
  },
  {
    id: 'update-website', group: 'Websites', method: 'PATCH', path: '/agency/websites/:id', 'x-scope': 'agency:write',
    summary: 'Rename or move a website', description: '`client_id: null` takes the website out of any client.',
    pathParams: idParam('website'),
    body: [
      { name: 'name', type: 'string', description: 'Website name.' },
      { name: 'url', type: 'string', description: 'The site’s address.' },
      { name: 'client_id', type: 'uuid | null', description: 'Move it to this client, or `null`.' },
    ],
    example: { params: { id: SITE_ID } },
    requestExample: { client_id: null },
    responseExample: { data: { ...website, client_id: null } },
  },
  {
    id: 'delete-website', group: 'Websites', method: 'DELETE', path: '/agency/websites/:id', 'x-scope': 'agency:write',
    summary: 'Delete a website and everything it collected', pathParams: idParam('website'), example: { params: { id: SITE_ID } },
    status: 204, responseExample: null,
  },
  {
    id: 'get-install', group: 'Websites', method: 'GET', path: '/agency/websites/:id/install', 'x-scope': 'agency:read',
    summary: 'Install snippet, instructions and tracking status', pathParams: idParam('website'), example: { params: { id: SITE_ID } },
    responseExample: { data: install },
  },
  {
    id: 'verify-website', group: 'Websites', method: 'POST', path: '/agency/websites/:id/verify', 'x-scope': 'agency:write',
    summary: 'Check again whether events are arriving', pathParams: idParam('website'), example: { params: { id: SITE_ID } },
    responseExample: { data: verification },
  },

  // ─── Branding ─────────────────────────────────────────────────────────────
  {
    id: 'get-branding', group: 'Branding', method: 'GET', path: '/agency/branding', 'x-scope': 'agency:read',
    summary: 'White-label settings', responseExample: { data: branding },
  },
  {
    id: 'update-branding', group: 'Branding', method: 'PUT', path: '/agency/branding', 'x-scope': 'agency:write',
    summary: 'Save white-label settings',
    body: [
      { name: 'brand_name', type: 'string', description: 'Shown in place of Seentics.' },
      { name: 'logo_url', type: 'string', description: 'An https:// image address.' },
      { name: 'primary_color', type: 'string', description: 'Hex colour, e.g. `#7c3aed`.' },
      { name: 'support_email', type: 'string', description: 'Where clients write for help.' },
      { name: 'footer_text', type: 'string', description: 'A line under every page.' },
      { name: 'hide_seentics', type: 'boolean', description: 'Drop “Powered by Seentics”.' },
      { name: 'slug', type: 'string | null', description: '3–40 characters a–z, 0–9 and hyphens; your sign-in name on seentics.com. `null` clears it.' },
    ],
    requestExample: (({ updated_at: _u, ...rest }) => rest)(branding),
    responseExample: { data: branding },
  },
  {
    id: 'get-domain', group: 'Branding', method: 'GET', path: '/agency/domain', 'x-scope': 'agency:read',
    summary: 'Custom domain and its state', description: '`data` is `null` when there is no domain; 503 `provider_error` when this server offers no custom domains.',
    responseExample: { data: domain },
  },
  {
    id: 'set-domain', group: 'Branding', method: 'PUT', path: '/agency/domain', 'x-scope': 'agency:write',
    summary: 'Add or replace the custom domain',
    body: [{ name: 'hostname', type: 'string', required: true, description: 'A subdomain you control, e.g. reports.youragency.com.' }],
    requestExample: { hostname: 'reports.meridian.test' },
    responseExample: { data: domain },
  },
  {
    id: 'refresh-domain', group: 'Branding', method: 'POST', path: '/agency/domain/refresh', 'x-scope': 'agency:write',
    summary: 'Check DNS and the certificate now', responseExample: { data: { ...domain, state: 'pending_certificate' } },
  },
  {
    id: 'delete-domain', group: 'Branding', method: 'DELETE', path: '/agency/domain', 'x-scope': 'agency:write',
    summary: 'Remove the custom domain', status: 204, responseExample: null,
  },

  // ─── Embeds ───────────────────────────────────────────────────────────────
  {
    id: 'list-embeds', group: 'Embeds', method: 'GET', path: '/agency/embeds', 'x-scope': 'agency:read',
    summary: 'List embed links',
    query: [
      { name: 'scope', type: '"website" | "client"', description: 'Only links of this scope.' },
      { name: 'target_id', type: 'uuid', description: 'Only links for this website or client.' },
      ...pagination,
    ],
    example: { query: { scope: 'client', target_id: CLIENT_ID } },
    responseExample: { data: [embed], page: page() },
  },
  {
    id: 'create-embed', group: 'Embeds', method: 'POST', path: '/agency/embeds', 'x-scope': 'agency:write',
    summary: 'Create an embed link', description: 'A read-only dashboard anyone with the link can open. 201 when made; 200 with the existing link when the target already has one.', status: 201,
    body: [
      { name: 'scope', type: '"website" | "client"', required: true, description: 'One website, or all of a client’s.' },
      { name: 'target_id', type: 'uuid', required: true, description: 'The website or client.' },
      { name: 'sections', type: '("analytics" | "recordings" | "heatmaps")[]', description: 'Default `["analytics"]`.' },
    ],
    requestExample: { scope: 'client', target_id: CLIENT_ID, sections: ['analytics'] },
    responseExample: { data: embed },
  },
  {
    id: 'update-embed', group: 'Embeds', method: 'PATCH', path: '/agency/embeds/:id', 'x-scope': 'agency:write',
    summary: 'Change what an embed link shows', pathParams: idParam('embed link'),
    body: [{ name: 'sections', type: 'string[]', required: true, description: 'The sections to show.' }],
    example: { params: { id: EMBED_ID } },
    requestExample: { sections: ['analytics', 'heatmaps'] },
    responseExample: { data: { ...embed, sections: ['analytics', 'heatmaps'] } },
  },
  {
    id: 'delete-embed', group: 'Embeds', method: 'DELETE', path: '/agency/embeds/:id', 'x-scope': 'agency:write',
    summary: 'Revoke an embed link', description: 'Creating one again gives a new URL.', pathParams: idParam('embed link'), example: { params: { id: EMBED_ID } },
    status: 204, responseExample: null,
  },

  // ─── Usage ────────────────────────────────────────────────────────────────
  {
    id: 'usage', group: 'Usage', method: 'GET', path: '/agency/usage', 'x-scope': 'agency:read',
    summary: 'This month’s pool, use, allocation and overage', query: monthQuery, responseExample: { data: usage },
  },
  {
    id: 'usage-clients', group: 'Usage', method: 'GET', path: '/agency/usage/clients', 'x-scope': 'agency:read',
    summary: 'Use per client this month', query: monthQuery,
    responseExample: { data: [usageRow], page: page() },
  },
  {
    id: 'usage-websites', group: 'Usage', method: 'GET', path: '/agency/usage/websites', 'x-scope': 'agency:read',
    summary: 'Use per website this month',
    query: [{ name: 'client_id', type: 'uuid', description: 'Only this client’s websites.' }, ...monthQuery],
    example: { query: { client_id: CLIENT_ID } },
    responseExample: { data: [{ ...usageRow, id: SITE_ID, client_id: CLIENT_ID }], page: page() },
  },
  {
    id: 'client-usage', group: 'Usage', method: 'GET', path: '/agency/clients/:id/usage', 'x-scope': 'agency:read',
    summary: 'One client’s use this month, with its websites', pathParams: idParam('client'), query: monthQuery, example: { params: { id: CLIENT_ID } },
    responseExample: { data: { period: usage.period, ...usageRow, websites: [{ ...usageRow, id: SITE_ID, client_id: CLIENT_ID }] } },
  },
  {
    id: 'website-usage', group: 'Usage', method: 'GET', path: '/agency/websites/:id/usage', 'x-scope': 'agency:read',
    summary: 'One website’s use this month', pathParams: idParam('website'), query: monthQuery, example: { params: { id: SITE_ID } },
    responseExample: { data: { period: usage.period, ...usageRow, id: SITE_ID, client_id: CLIENT_ID } },
  },
];

export const AGENCY_API_GROUPS = Array.from(new Set(AGENCY_API.map(e => e.group)));

export const AGENCY_ERROR_CODES: Array<{ code: string; status: number; meaning: string }> = [
  { code: 'unauthorized', status: 401, meaning: 'No session or API key, or it is no longer valid.' },
  { code: 'forbidden', status: 403, meaning: 'The key lacks the scope, or the team member lacks agency access.' },
  { code: 'agency_plan_required', status: 403, meaning: 'The account is not on the Agency plan.' },
  { code: 'not_found', status: 404, meaning: 'No such client, website, embed or alert in this account.' },
  { code: 'validation_failed', status: 422, meaning: 'The body or query is invalid; `details` says which field.' },
  { code: 'conflict', status: 409, meaning: 'Already exists, such as an external ID or hostname in use.' },
  { code: 'idempotency_conflict', status: 409, meaning: 'The same Idempotency-Key was sent with a different body.' },
  { code: 'rate_limited', status: 429, meaning: '120 requests a minute per key (60 writes); wait and retry.' },
  { code: 'provider_error', status: 502, meaning: 'Our DNS or certificate provider failed; retry later. 503 when the service, or custom domains, are not available.' },
];
