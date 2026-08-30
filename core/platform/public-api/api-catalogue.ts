/**
 * The public API, described.
 *
 * One source of truth for what the raw API offers, consumed by the dashboard's developer
 * tab and served from the API itself. Hand-written docs drift the moment an endpoint is
 * added; a catalogue the server owns and a test compares against the router cannot.
 *
 * Descriptions are written for someone building against this from outside, so they say
 * what a caller gets rather than which service it came from.
 */

import type { ApiScope } from "./keys/scopes";

export type ApiParam = {
  name: string;
  description: string;
  /** Shown in the reference so a caller knows what happens when they omit it. */
  default?: string;
};

export type ApiEndpoint = {
  /** Path relative to the raw API base, exactly as the router registers it. */
  path: string;
  method: 'GET';
  /** Grouping in the reference, and the shape of the answer. */
  group: 'Analytics' | 'Realtime' | 'Behaviour' | 'Events' | 'Sessions' | 'Heatmaps';
  summary: string;
  scope: ApiScope;
  params: ApiParam[];
};

/** The three parameters most analytics endpoints share. */
const WINDOW_PARAMS: ApiParam[] = [
  { name: 'days', description: 'Trailing window, 1–365.', default: '7' },
  { name: 'timezone', description: 'IANA zone for day bucketing. Invalid values fall back to UTC.', default: 'UTC' },
  { name: 'limit', description: 'Maximum rows, where the endpoint returns a list.', default: '50' },
];

const SITE = '/v1/websites/:website_id';

function analyticsEndpoint(path: string, summary: string, params = WINDOW_PARAMS): ApiEndpoint {
  return { path: `${SITE}/analytics/${path}`, method: 'GET', group: 'Analytics', summary, scope: 'analytics:read', params };
}

export const API_CATALOGUE: ApiEndpoint[] = [
  // ─── Headline figures ──────────────────────────────────────────────────────
  analyticsEndpoint('dashboard', 'Headline KPIs with a period-over-period comparison.'),
  analyticsEndpoint('traffic-summary', 'Visitors and views split by acquisition channel.'),
  analyticsEndpoint('daily-stats', 'Views and unique visitors per day.'),
  analyticsEndpoint('hourly-stats', 'Views and unique visitors per hour of the day.'),
  analyticsEndpoint('activity-trends', 'Daily activity series, same shape as daily-stats.'),

  // ─── Breakdowns ────────────────────────────────────────────────────────────
  analyticsEndpoint('top-pages', 'Most-viewed pages.'),
  analyticsEndpoint('top-referrers', 'Referring sites, deduplicated per session.'),
  analyticsEndpoint('top-sources', 'UTM sources with a bounce rate.'),
  analyticsEndpoint('top-countries', 'Visitors by country.'),
  analyticsEndpoint('top-cities', 'Visitors by city.'),
  analyticsEndpoint('top-languages', 'Visitors by browser language.'),
  analyticsEndpoint('top-browsers', 'Visitors by browser.'),
  analyticsEndpoint('top-devices', 'Visitors by device type.'),
  analyticsEndpoint('top-os', 'Visitors by operating system.'),
  analyticsEndpoint('top-resolutions', 'Visitors by screen resolution.'),
  analyticsEndpoint('geolocation-breakdown', 'Countries and cities with each share of visitors.'),

  // ─── Behaviour ─────────────────────────────────────────────────────────────
  {
    ...analyticsEndpoint('visitor-insights', 'New versus returning visitors, and entry and exit pages.'),
    group: 'Behaviour',
  },
  {
    ...analyticsEndpoint('custom-events', 'Custom event counts and UTM performance.'),
    group: 'Behaviour',
  },
  {
    ...analyticsEndpoint('goals-stats', 'Goal completions and conversion rates.'),
    group: 'Behaviour',
  },
  {
    // Deliberately takes no parameters: this endpoint has never honoured `days`, and
    // starting to would change a public API's behaviour without anyone asking.
    ...analyticsEndpoint('path-analysis', 'The first three pages of each session, grouped.', []),
    group: 'Behaviour',
  },
  {
    ...analyticsEndpoint('page-utm-breakdown', 'Page views split by UTM source, medium and campaign.', []),
    group: 'Behaviour',
  },

  // ─── Realtime ──────────────────────────────────────────────────────────────
  {
    ...analyticsEndpoint('realtime', 'The last 30 minutes: active visitors, top pages, and a per-minute timeline.', []),
    group: 'Realtime',
  },
  {
    ...analyticsEndpoint('live-visitors', 'Visitors active in the last 30 seconds, and in the last 30 minutes.', []),
    group: 'Realtime',
  },
  {
    ...analyticsEndpoint('recent-activity', 'The most recent pageviews with visitor context.', [
      { name: 'limit', description: 'Rows to return, 1–100.', default: '50' },
    ]),
    group: 'Realtime',
  },

  // ─── Raw data ──────────────────────────────────────────────────────────────
  {
    path: `${SITE}/analytics/export`,
    method: 'GET',
    group: 'Events',
    summary: 'Up to 10,000 raw events with every column, for a bulk extract.',
    scope: 'analytics:read',
    params: [],
  },
  {
    path: `${SITE}/analytics/events`,
    method: 'GET',
    group: 'Events',
    summary: 'Raw events, paginated and filterable — the endpoint to build your own reports on.',
    scope: 'analytics:read',
    params: [
      { name: 'from', description: 'ISO-8601 lower bound, inclusive.' },
      { name: 'to', description: 'ISO-8601 upper bound, inclusive.' },
      { name: 'event_type', description: 'Only events of this type, e.g. `pageview` or `purchase`.' },
      { name: 'limit', description: 'Rows per page, 1–1000.', default: '100' },
      { name: 'offset', description: 'Rows to skip.', default: '0' },
    ],
  },
  {
    path: `${SITE}/sessions`,
    method: 'GET',
    group: 'Sessions',
    summary: 'Recorded sessions with their metadata.',
    scope: 'replays:read',
    params: [
      { name: 'limit', description: 'Rows per page, 1–500.', default: '50' },
      { name: 'offset', description: 'Rows to skip.', default: '0' },
    ],
  },
  {
    path: `${SITE}/heatmap/pages`,
    method: 'GET',
    group: 'Heatmaps',
    summary: 'Pages that have heatmap data collected.',
    scope: 'heatmaps:read',
    params: [],
  },
  {
    path: `${SITE}/heatmap/points`,
    method: 'GET',
    group: 'Heatmaps',
    summary: 'Interaction points for one page, as normalised coordinates.',
    scope: 'heatmaps:read',
    params: [
      { name: 'page_path', description: 'The page to read points for. Required.' },
      { name: 'event_type', description: 'Interaction kind, e.g. `click` or `move`.', default: 'click' },
    ],
  },
];

/** The base every catalogue path is relative to. */
export const API_BASE_PATH = '/api/v1/raw';
