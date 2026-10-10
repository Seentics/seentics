import type { DocField, EndpointDoc } from '@/components/developers/EndpointReference';

/**
 * The management API (`/api/v1/manage`), endpoint by endpoint.
 *
 * Written from Core's routes — `app/http/management-api/routes.ts` and the websites
 * module's `client.controller.ts` / `validators/client.schema.ts` — and every example
 * response is a real one, captured 2026-10-09 and trimmed. When a route changes, change
 * it here in the same commit.
 */

const CLIENT_ID = '5bbeaa88-b089-4923-ad54-8fdcbbcdba94';
const SITE_ID = '2f60eb30-722c-4fbf-8afa-99fe0e67f6d9';
const SCRIPT = 'https://app.seentics.com/trackers/seentics.min.js';
const SNIPPET = `<script defer data-website-id="${SITE_ID}" src="${SCRIPT}"></script>`;

const clientWebsite = {
  id: SITE_ID,
  client_id: CLIENT_ID,
  name: 'Acme Bakery',
  url: 'acme.yourapp.com',
  tracking_id: 'ST-76d3842a9594c586',
  is_active: true,
  script_url: SCRIPT,
  snippet: SNIPPET,
  created_at: '2026-10-09T07:50:21.163Z',
};

const client = {
  id: CLIENT_ID,
  external_id: 'tenant_482',
  name: 'Acme Bakery',
  company: '',
  email: '',
  website_url: '',
  note: '',
  status: 'active',
  features_enabled: { analytics: true, heatmaps: true, replays: false, funnels: true, automations: true, errors: true },
  limits: { max_websites: null, max_monthly_events: 10000, max_replays: 100, max_heatmaps: null },
  metadata: {},
  websites: [clientWebsite],
  created_at: '2026-10-09T07:50:21.158Z',
  updated_at: '2026-10-09T07:50:21.158Z',
};

/** A website as `/manage/websites` returns it: the dashboard's full record plus the snippet. */
const website = {
  id: SITE_ID,
  website_id: SITE_ID,
  name: 'Acme Bakery',
  url: 'acme.yourapp.com',
  tracking_id: 'ST-76d3842a9594c586',
  is_active: true,
  client_id: CLIENT_ID,
  replay_enabled: true,
  heatmap_enabled: true,
  funnel_enabled: true,
  automation_enabled: true,
  errors_enabled: true,
  created_at: '2026-10-09T07:52:33.324Z',
  updated_at: '2026-10-09T07:52:33.324Z',
  stats: { totalPageviews: 0, uniqueVisitors: 0, averageSessionDuration: 0, bounceRate: 0 },
  script_url: SCRIPT,
  snippet: SNIPPET,
};

const CLIENT_PATH: DocField[] = [{ name: 'id', type: 'uuid', required: true, description: 'The client id Seentics returned when it was created.' }];
const WEBSITE_PATH: DocField[] = [{ name: 'id', type: 'uuid', required: true, description: 'The website id.' }];
const PAGE: DocField[] = [
  { name: 'limit', type: 'integer', description: 'Rows to return, 1–100.', default: '50' },
  { name: 'offset', type: 'integer', description: 'Rows to skip.', default: '0' },
];

const CLIENT_FIELDS: DocField[] = [
  { name: 'name', type: 'string', required: true, description: 'Display name, up to 120 characters.' },
  { name: 'external_id', type: 'string | null', description: 'Your own id for this tenant, unique in your account. Creating with an id that already exists returns that client instead of a new one.' },
  {
    name: 'website', type: 'object', description: "Optional: create the client's first website in the same call.",
    children: [
      { name: 'name', type: 'string', required: true, description: 'Website display name.', example: 'Acme Bakery' },
      { name: 'url', type: 'string', required: true, description: 'Bare host or full URL; only this exact host is tracked.', example: 'acme.yourapp.com' },
    ],
  },
  { name: 'features_enabled', type: 'object', description: 'Switch features off (absent is on): analytics, replays, heatmaps, funnels, automations, errors.' },
  { name: 'limits', type: 'object', description: 'Monthly caps, a number or null for uncapped: max_monthly_events, max_replays, max_heatmaps, max_websites.' },
  { name: 'status', type: 'string', description: 'active, suspended or archived; anything but active stops collection.', default: 'active' },
  { name: 'company', type: 'string', description: 'Shown in the dashboard.', example: 'Acme Ltd' },
  { name: 'email', type: 'string', description: 'Contact address, shown in the dashboard.', example: 'owner@acme.com' },
  { name: 'note', type: 'string', description: 'Internal note, up to 2000 characters.', example: 'Signed up via the Pro plan' },
  { name: 'metadata', type: 'object', description: 'Your own key/values, up to 4 KB of JSON.', example: { plan: 'pro' } },
];

const AUTH_ERRORS = [
  { status: 401, code: 'missing_api_key', when: 'No X-API-Key header.' },
  { status: 401, code: 'invalid_api_key', when: 'The key is unknown or revoked.' },
];
const SECTIONS_NOTE = " **Sections:** a link chooses what it shows. `analytics` (on by default), `recordings` (off by default: it shows real visitor sessions, so enable it deliberately) and `heatmaps` (off by default). Send `sections` when you create the link, or change them later with `PATCH` on this path; the URL stays the same and the change applies at once.";
const SECTIONS_FIELD: DocField = { name: 'sections', type: 'string[]', description: 'Which sections the link shows: any of `analytics`, `recordings`, `heatmaps`. At least one. Ignored when the link already exists (use `PATCH` to change it).', default: '["analytics"]', example: ['analytics'] };
const SECTIONS_REQUIRED: DocField = { ...SECTIONS_FIELD, required: true, description: 'The sections the link shows from now on: any of `analytics`, `recordings`, `heatmaps`. At least one. Replaces the current list.', default: undefined, example: ['analytics', 'recordings'] };
const WRITE_ERRORS = [
  ...AUTH_ERRORS,
  { status: 403, code: 'insufficient_scope', when: 'A key without `websites:write` was used to write.' },
  { status: 400, code: 'validation_error', when: 'The body failed validation; `issues` lists each field.' },
];

export const MANAGEMENT_API: EndpointDoc[] = [
  {
    method: 'POST', path: '/clients', group: 'Clients', access: 'websites:write',
    title: 'Create a client',
    description: "Call this from your signup handler when a new tenant joins. It creates the client and, with `website`, its first website — the response carries the tracking snippet to install on the tenant's pages. Send your own tenant id as `external_id` and retries are safe: the same id returns the existing client with `created: false` instead of making a second one.",
    body: CLIENT_FIELDS,
    exampleBody: {
      external_id: 'tenant_482', name: 'Acme Bakery', website: { name: 'Acme Bakery', url: 'acme.yourapp.com' },
      features_enabled: { replays: false }, limits: { max_monthly_events: 10000, max_replays: 100 },
    },
    status: 201,
    exampleResponse: { data: client, created: true },
    errors: [
      ...WRITE_ERRORS,
      { status: 200, code: 'created: false', when: 'A client with this external_id already exists — it is returned unchanged.' },
      { status: 403, code: 'LIMIT_REACHED', when: "Your plan's website limit is reached (Cloud)." },
    ],
  },
  {
    method: 'GET', path: '/clients', group: 'Clients', access: 'websites:read',
    title: 'List clients',
    description: 'Every client in your account with its websites and their snippets, oldest first. Pass `external_id` to look up one tenant by your own id instead of storing ours.',
    query: [...PAGE, { name: 'external_id', type: 'string', description: 'Return only the client with this id of yours.' }],
    status: 200,
    exampleResponse: { data: [client], has_more: false },
    errors: AUTH_ERRORS,
  },
  {
    method: 'GET', path: '/clients/:id', group: 'Clients', access: 'websites:read',
    title: 'Get a client',
    description: "One client: its feature switches, monthly caps, and websites with their tracking snippets.",
    pathParams: CLIENT_PATH,
    status: 200,
    exampleResponse: { data: client },
    errors: [...AUTH_ERRORS, { status: 404, code: 'not found', when: 'No such client in your account.' }],
  },
  {
    method: 'PATCH', path: '/clients/:id', group: 'Clients', access: 'websites:write',
    title: 'Update a client',
    description: "Change any field — typically when a tenant changes plan. `features_enabled` and `limits` merge into what is already set, so sending one key changes only that one: `{ \"limits\": { \"max_replays\": 150 } }` leaves the other caps alone. Set `status` to `suspended` to stop collection on all of the client's sites, e.g. when a tenant stops paying.",
    pathParams: CLIENT_PATH,
    body: CLIENT_FIELDS.filter(f => f.name !== 'website').map(f => ({ ...f, required: false })),
    exampleBody: { features_enabled: { replays: true }, limits: { max_replays: 150 } },
    status: 200,
    exampleResponse: {
      data: {
        ...client,
        features_enabled: { ...client.features_enabled, replays: true },
        limits: { ...client.limits, max_replays: 150 },
        updated_at: '2026-10-09T08:02:10.411Z',
      },
    },
    errors: [...WRITE_ERRORS, { status: 404, code: 'not found', when: 'No such client in your account.' }, { status: 409, code: 'external_id_taken', when: 'Another client already has that external_id.' }],
  },
  {
    method: 'DELETE', path: '/clients/:id', group: 'Clients', access: 'websites:write',
    title: 'Delete a client',
    description: "Removes the client with its switches and caps. Its websites keep tracking and keep their data, just no longer grouped — unless you pass `delete_websites=true`, which deletes them and everything they collected.",
    pathParams: CLIENT_PATH,
    query: [{ name: 'delete_websites', type: 'boolean', description: 'Also delete the websites and everything they collected.', default: 'false' }],
    status: 204,
    exampleResponse: null,
    errors: [...AUTH_ERRORS, { status: 404, code: 'not found', when: 'No such client in your account.' }],
  },
  {
    method: 'POST', path: '/websites', group: 'Websites', access: 'websites:write',
    title: 'Create a website',
    description: "Adds a website on its own, or under a client with `client_id`. Only pages on the exact host you give are tracked, so a multi-tenant app gives each tenant subdomain its own website. The response includes the snippet to install.",
    body: [
      { name: 'name', type: 'string', required: true, description: 'Website display name.' },
      { name: 'url', type: 'string', required: true, description: 'Bare host or full URL; only this exact host is tracked, so give each tenant subdomain its own website.' },
      { name: 'client_id', type: 'uuid | null', description: "File it under this client. Counts against the client's max_websites." },
    ],
    exampleBody: { name: 'Acme Bakery', url: 'acme.yourapp.com', client_id: CLIENT_ID },
    status: 201,
    exampleResponse: { data: website },
    errors: [...WRITE_ERRORS, { status: 404, code: 'not_found', when: 'client_id is not a client of yours.' }, { status: 409, code: 'website_limit_reached', when: 'The client is at its max_websites.' }],
  },
  {
    method: 'GET', path: '/websites', group: 'Websites', access: 'websites:read',
    title: 'List websites',
    description: "Every website in your account, oldest first. Pass `client_id` to list one client's websites.",
    query: [...PAGE, { name: 'client_id', type: 'uuid', description: "Only this client's websites." }],
    status: 200,
    exampleResponse: { data: [website], has_more: false },
    errors: AUTH_ERRORS,
  },
  {
    method: 'GET', path: '/websites/:id', group: 'Websites', access: 'websites:read',
    title: 'Get a website',
    description: "One website's full settings, with its tracking snippet.",
    pathParams: WEBSITE_PATH,
    status: 200,
    exampleResponse: { data: website },
    errors: [...AUTH_ERRORS, { status: 404, code: 'not found', when: 'No such website in your account.' }],
  },
  {
    method: 'PATCH', path: '/websites/:id', group: 'Websites', access: 'websites:write',
    title: 'Update a website',
    description: "Change a website's name, host or feature flags, or move it: `client_id` files it under another client, `null` takes it out of any. `is_active: false` stops collection for this website alone.",
    pathParams: WEBSITE_PATH,
    body: [
      { name: 'name', type: 'string', description: 'Display name.' },
      { name: 'url', type: 'string', description: 'Host to track.' },
      { name: 'is_active', type: 'boolean', description: 'false stops collection for this site.' },
      { name: 'client_id', type: 'uuid | null', description: 'Move to this client, or null to ungroup.' },
      { name: 'replay_enabled', type: 'boolean', description: 'Also heatmap_enabled, funnel_enabled, automation_enabled, errors_enabled.' },
    ],
    exampleBody: { is_active: false },
    status: 200,
    exampleResponse: { data: { ...website, is_active: false } },
    errors: [...WRITE_ERRORS, { status: 404, code: 'not found', when: 'No such website, or client_id is not yours.' }],
  },
  {
    method: 'DELETE', path: '/websites/:id', group: 'Websites', access: 'websites:write',
    title: 'Delete a website',
    description: 'Deletes the website and everything it collected — events, recordings and heatmaps. This cannot be undone.',
    pathParams: WEBSITE_PATH,
    status: 204,
    exampleResponse: null,
    errors: [...AUTH_ERRORS, { status: 404, code: 'not found', when: 'No such website in your account.' }],
  },
  {
    method: 'POST', path: '/websites/:id/embed-link', group: 'Embeds', access: 'websites:write',
    title: 'Create an embed link for a website',
    description: "A permanent, read-only link to a dashboard of one website, for an iframe in your own app (a sidebar page, say). It never expires: it works until you revoke it with `DELETE` on this same path. Calling it again returns the same link (`200`); revoking and calling again makes a new one with a new URL. Anyone who holds the URL can see that website's analytics, so treat it like a secret and keep it behind your own login. Add `&theme=light` or `dark` and `&days=7`, `30` or `90` to change how it opens. Example: `<iframe src=\"https://app.seentics.com/embed/<website_id>?token=…\" width=\"100%\" height=\"900\" style=\"border:0\"></iframe>`; put the `embed_url` from the response in the `src`." + SECTIONS_NOTE,
    pathParams: WEBSITE_PATH,
    body: [SECTIONS_FIELD],
    status: 201,
    exampleResponse: {
      data: {
        id: 'c7f3b1de-0f0e-4a0c-9d8e-3f1a52c4b7a1',
        scope: 'website',
        target_id: SITE_ID,
        target_name: 'Acme Bakery',
        token: 'eyJhbGciOiJIUzI1NiJ9.eyJ0eXAiOiJlbWJlZCIsImxpZCI6…',
        embed_url: `https://app.seentics.com/embed/${SITE_ID}?token=eyJhbGciOiJIUzI1NiJ9.eyJ0eXAiOiJlbWJlZCIsImxpZCI6…`,
        sections: ['analytics'],
        created_at: '2026-10-10T09:12:44.000Z',
      },
    },
    errors: [...WRITE_ERRORS, { status: 404, code: 'not found', when: 'No such website in your account.' }],
  },
  {
    method: 'PATCH', path: '/websites/:id/embed-link', group: 'Embeds', access: 'websites:write',
    title: 'Change what a website embed link shows',
    description: "Replaces the sections the link exposes (`analytics`, `recordings`, `heatmaps`). The URL and token do not change, and the new set applies at once: a visitor of the embed who opens a section that was just removed gets `403 embed_section_disabled`. Recordings show real visitor sessions, so enable them deliberately. Returns the link.",
    pathParams: WEBSITE_PATH,
    body: [SECTIONS_REQUIRED],
    status: 200,
    exampleResponse: {
      data: {
        id: 'c7f3b1de-0f0e-4a0c-9d8e-3f1a52c4b7a1',
        scope: 'website',
        target_id: SITE_ID,
        target_name: 'Acme Bakery',
        token: 'eyJhbGciOiJIUzI1NiJ9.eyJ0eXAiOiJlbWJlZCIsImxpZCI6…',
        embed_url: `https://app.seentics.com/embed/${SITE_ID}?token=eyJhbGciOiJIUzI1NiJ9.eyJ0eXAiOiJlbWJlZCIsImxpZCI6…`,
        sections: ['analytics', 'recordings'],
        created_at: '2026-10-10T09:12:44.000Z',
      },
    },
    errors: [...WRITE_ERRORS, { status: 404, code: 'not found', when: 'No such website in your account, or it has no live embed link.' }],
  },
  {
    method: 'DELETE', path: '/websites/:id/embed-link', group: 'Embeds', access: 'websites:write',
    title: 'Revoke a website embed link',
    description: "Revokes the embed link. The URL stops working at once (within about 30 seconds if Seentics runs on several servers); the next `POST` makes a new link with a new URL.",
    pathParams: WEBSITE_PATH,
    status: 204,
    exampleResponse: null,
    errors: [...AUTH_ERRORS, { status: 404, code: 'not found', when: 'No such website in your account, or it has no live embed link.' }],
  },
  {
    method: 'POST', path: '/clients/:id/embed-link', group: 'Embeds', access: 'websites:write',
    title: 'Create an embed link for a client',
    description: "A permanent, read-only link to a dashboard of all of one client's websites, with a switcher between them, for an iframe in your own app (a sidebar page, say). It never expires: it works until you revoke it with `DELETE` on this same path. Calling it again returns the same link (`200`); revoking and calling again makes a new one with a new URL. Anyone who holds the URL can see all of that client's websites' analytics, so treat it like a secret and keep it behind your own login. Add `&theme=light` or `dark` and `&days=7`, `30` or `90` to change how it opens. Example: `<iframe src=\"https://app.seentics.com/embed/<client_id>?token=…&client=1\" width=\"100%\" height=\"900\" style=\"border:0\"></iframe>`; put the `embed_url` from the response in the `src`." + SECTIONS_NOTE,
    pathParams: CLIENT_PATH,
    body: [SECTIONS_FIELD],
    status: 201,
    exampleResponse: {
      data: {
        id: 'e91a6b2c-5d7f-4c3e-8a10-72b9d4f0c6e3',
        scope: 'client',
        target_id: CLIENT_ID,
        target_name: 'Acme Bakery',
        token: 'eyJhbGciOiJIUzI1NiJ9.eyJ0eXAiOiJlbWJlZCIsImxpZCI6…',
        embed_url: `https://app.seentics.com/embed/${CLIENT_ID}?token=eyJhbGciOiJIUzI1NiJ9.eyJ0eXAiOiJlbWJlZCIsImxpZCI6…&client=1`,
        sections: ['analytics'],
        created_at: '2026-10-10T09:12:44.000Z',
      },
    },
    errors: [...WRITE_ERRORS, { status: 404, code: 'not found', when: 'No such client in your account.' }],
  },
  {
    method: 'PATCH', path: '/clients/:id/embed-link', group: 'Embeds', access: 'websites:write',
    title: 'Change what a client embed link shows',
    description: "Replaces the sections the link exposes (`analytics`, `recordings`, `heatmaps`). The URL and token do not change, and the new set applies at once: a visitor of the embed who opens a section that was just removed gets `403 embed_section_disabled`. Recordings show real visitor sessions, so enable them deliberately. Returns the link.",
    pathParams: CLIENT_PATH,
    body: [SECTIONS_REQUIRED],
    status: 200,
    exampleResponse: {
      data: {
        id: 'c7f3b1de-0f0e-4a0c-9d8e-3f1a52c4b7a1',
        scope: 'client',
        target_id: CLIENT_ID,
        target_name: 'Acme Bakery',
        token: 'eyJhbGciOiJIUzI1NiJ9.eyJ0eXAiOiJlbWJlZCIsImxpZCI6…',
        embed_url: `https://app.seentics.com/embed/${CLIENT_ID}?token=eyJhbGciOiJIUzI1NiJ9.eyJ0eXAiOiJlbWJlZCIsImxpZCI6…&client=1`,
        sections: ['analytics', 'recordings'],
        created_at: '2026-10-10T09:12:44.000Z',
      },
    },
    errors: [...WRITE_ERRORS, { status: 404, code: 'not found', when: 'No such client in your account, or it has no live embed link.' }],
  },
  {
    method: 'DELETE', path: '/clients/:id/embed-link', group: 'Embeds', access: 'websites:write',
    title: 'Revoke a client embed link',
    description: "Revokes the embed link. The URL stops working at once (within about 30 seconds if Seentics runs on several servers); the next `POST` makes a new link with a new URL.",
    pathParams: CLIENT_PATH,
    status: 204,
    exampleResponse: null,
    errors: [...AUTH_ERRORS, { status: 404, code: 'not found', when: 'No such client in your account, or it has no live embed link.' }],
  },
];
