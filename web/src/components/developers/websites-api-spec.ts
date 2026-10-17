import type { DocField, EndpointDoc } from '@/components/developers/EndpointReference';

/**
 * The Management API as the Developers page documents it: `/api/v1/manage/websites` only.
 *
 * Clients, their caps and embeds are the Agency workspace's (`/agency`, `/api/v1/agency/*`), so
 * they are not here. Written from Core's `app/http/management-api/routes.ts`; example responses
 * are real ones, captured 2026-10-09 and trimmed. When a route changes, change it here too.
 */

const SITE_ID = '2f60eb30-722c-4fbf-8afa-99fe0e67f6d9';
const SCRIPT = 'https://seentics.com/trackers/seentics.min.js';
const SNIPPET = `<script defer data-website-id="${SITE_ID}" src="${SCRIPT}"></script>`;

/** A website as `/manage/websites` returns it: the dashboard's full record plus the snippet. */
const website = {
  id: SITE_ID,
  website_id: SITE_ID,
  name: 'Acme Bakery',
  url: 'acme.example.com',
  tracking_id: 'ST-76d3842a9594c586',
  is_active: true,
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

const WEBSITE_PATH: DocField[] = [{ name: 'id', type: 'uuid', required: true, description: 'The website id.' }];
const PAGE: DocField[] = [
  { name: 'limit', type: 'integer', description: 'Rows to return, 1–100.', default: '50' },
  { name: 'offset', type: 'integer', description: 'Rows to skip.', default: '0' },
];

const AUTH_ERRORS = [
  { status: 401, code: 'missing_api_key', when: 'No X-API-Key header.' },
  { status: 401, code: 'invalid_api_key', when: 'The key is unknown or revoked.' },
];
const WRITE_ERRORS = [
  ...AUTH_ERRORS,
  { status: 403, code: 'insufficient_scope', when: 'A key without `websites:write` was used to write.' },
  { status: 400, code: 'validation_error', when: 'The body failed validation; `issues` lists each field.' },
];
const NOT_FOUND = { status: 404, code: 'not found', when: 'No such website in your account.' };

export const WEBSITES_API: EndpointDoc[] = [
  {
    method: 'POST', path: '/websites', group: 'Websites', access: 'websites:write',
    title: 'Create a website',
    description: 'Adds a website to your account. Only pages on the exact host you give are tracked, so give each subdomain that should be counted on its own a website of its own. The response includes the snippet to install.',
    body: [
      { name: 'name', type: 'string', required: true, description: 'Website display name.' },
      { name: 'url', type: 'string', required: true, description: 'Bare host or full URL; only this exact host is tracked.' },
    ],
    exampleBody: { name: 'Acme Bakery', url: 'acme.example.com' },
    status: 201,
    exampleResponse: { data: website },
    errors: [...WRITE_ERRORS, { status: 403, code: 'LIMIT_REACHED', when: "Your plan's website limit is reached (Cloud)." }],
  },
  {
    method: 'GET', path: '/websites', group: 'Websites', access: 'websites:read',
    title: 'List websites',
    description: 'Every website in your account, oldest first.',
    query: PAGE,
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
    errors: [...AUTH_ERRORS, NOT_FOUND],
  },
  {
    method: 'PATCH', path: '/websites/:id', group: 'Websites', access: 'websites:write',
    title: 'Update a website',
    description: "Change a website's name, host or feature flags. `is_active: false` stops collection for this website alone.",
    pathParams: WEBSITE_PATH,
    body: [
      { name: 'name', type: 'string', description: 'Display name.' },
      { name: 'url', type: 'string', description: 'Host to track.' },
      { name: 'is_active', type: 'boolean', description: 'false stops collection for this site.' },
      { name: 'replay_enabled', type: 'boolean', description: 'Also heatmap_enabled, funnel_enabled, automation_enabled, errors_enabled.' },
    ],
    exampleBody: { is_active: false },
    status: 200,
    exampleResponse: { data: { ...website, is_active: false } },
    errors: [...WRITE_ERRORS, NOT_FOUND],
  },
  {
    method: 'DELETE', path: '/websites/:id', group: 'Websites', access: 'websites:write',
    title: 'Delete a website',
    description: 'Deletes the website and everything it collected — events, recordings and heatmaps. This cannot be undone.',
    pathParams: WEBSITE_PATH,
    status: 204,
    exampleResponse: null,
    errors: [...AUTH_ERRORS, NOT_FOUND],
  },
];
