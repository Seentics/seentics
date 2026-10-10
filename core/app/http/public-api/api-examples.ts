/**
 * One example response per catalogue endpoint, keyed by its path.
 *
 * Captured from real calls against a seeded site (2026-10-09), lists cut to two rows and
 * the site id replaced with a fixed sample. Two rows are by hand because the capture
 * environment could not produce them: `top_cities` (needs the MaxMind database) and
 * `sessions` (needs recording storage) — both follow the row shape their code builds
 * (`cities.repository.ts`, `recording-session-list.service.ts`).
 *
 * `api-catalogue.test.ts` checks every catalogue path has one. When a response shape
 * changes, recapture rather than edit by hand: a hand-edited example drifts the same way
 * hand-written docs did.
 */

const SITE_ID = '9b1c6f3e-2d4a-4c8e-a1f7-5e3b2d9c0a41';
const P = '/v1/websites/:website_id';
const meta = { website_id: SITE_ID };

export const API_EXAMPLES: Record<string, unknown> = {
  [`${P}/analytics/dashboard`]: {
    meta,
    data: {
      website_id: SITE_ID, date_range: '7d', total_visitors: 12, unique_visitors: 12, sessions: 12, live_visitors: 1,
      page_views: 42, session_duration: 100, bounce_rate: 0,
      metrics: { page_views: 42, total_visitors: 12, unique_visitors: 12, sessions: 12, bounce_rate: 0, avg_session_time: 100, pages_per_session: 3.5 },
      comparison: {
        current_period: { total_visitors: 12, unique_visitors: 12, page_views: 42, sessions: 12, bounce_rate: 0, avg_session_time: 100 },
        previous_period: { total_visitors: 0, unique_visitors: 0, page_views: 0, sessions: 0, bounce_rate: 0, avg_session_time: 0 },
        visitor_change: 0, pageview_change: 0, session_change: 0, bounce_change: 0, duration_change: 0,
      },
    },
  },
  [`${P}/analytics/traffic-summary`]: {
    meta,
    data: {
      website_id: SITE_ID, date_range: '7d',
      channels: [
        { channel: 'organic', views: 24, sessions: 6, unique_visitors: 6 },
        { channel: 'direct', views: 12, sessions: 4, unique_visitors: 4 },
      ],
      total_views: 42, total_visitors: 12,
    },
  },
  [`${P}/analytics/daily-stats`]: { meta, data: { daily_stats: [{ date: '2026-10-09', views: 42, unique: 12 }] } },
  [`${P}/analytics/hourly-stats`]: {
    meta,
    data: {
      website_id: SITE_ID,
      hourly_stats: [
        { hour: 5, views: 4, unique: 1, hour_label: '05:00' },
        { hour: 6, views: 21, unique: 7, hour_label: '06:00' },
      ],
    },
  },
  [`${P}/analytics/activity-trends`]: { meta, data: { daily_stats: [{ date: '2026-10-09', views: 42, unique: 12 }] } },
  [`${P}/analytics/top-pages`]: {
    meta,
    data: { top_pages: [{ page: '/', views: 12, unique: 12 }, { page: '/menu', views: 12, unique: 12 }] },
  },
  [`${P}/analytics/top-referrers`]: {
    meta,
    data: { top_referrers: [{ referrer: 'google.com', views: 24, unique: 6 }, { referrer: 'direct', views: 18, unique: 6 }] },
  },
  [`${P}/analytics/top-sources`]: {
    meta,
    data: { website_id: SITE_ID, date_range: '7d', top_sources: [{ source: 'newsletter', views: 14, unique: 4, bounce_rate: 0 }] },
  },
  [`${P}/analytics/top-countries`]: {
    meta,
    data: { top_countries: [{ country: 'US', views: 22, unique: 6 }, { country: 'GB', views: 8, unique: 2 }] },
  },
  [`${P}/analytics/top-cities`]: {
    meta,
    data: { website_id: SITE_ID, top_cities: [{ city: 'New York', views: 18, unique: 5 }, { city: 'London', views: 8, unique: 2 }] },
  },
  [`${P}/analytics/top-languages`]: {
    meta,
    data: { website_id: SITE_ID, top_languages: [{ language: 'en-US', views: 22, unique: 6 }, { language: 'en-GB', views: 8, unique: 2 }] },
  },
  [`${P}/analytics/top-browsers`]: {
    meta,
    data: { top_browsers: [{ browser: 'Safari', views: 28, unique: 8 }, { browser: 'Chrome', views: 14, unique: 4 }] },
  },
  [`${P}/analytics/top-devices`]: {
    meta,
    data: { top_devices: [{ device: 'Desktop', views: 28, unique: 8 }, { device: 'Mobile', views: 14, unique: 4 }] },
  },
  [`${P}/analytics/top-os`]: {
    meta,
    data: { top_os: [{ os: 'iOS', views: 14, unique: 4 }, { os: 'macOS', views: 14, unique: 4 }] },
  },
  [`${P}/analytics/top-resolutions`]: {
    meta,
    data: {
      website_id: SITE_ID, date_range: '7d',
      top_resolutions: [{ resolution: '390x844', views: 14, unique: 4 }, { resolution: '1440x900', views: 14, unique: 4 }],
    },
  },
  [`${P}/analytics/geolocation-breakdown`]: {
    meta,
    data: {
      website_id: SITE_ID, date_range: '7d',
      countries: [
        { name: 'United States', code: 'US', count: 6, percentage: 50 },
        { name: 'Canada', code: 'CA', count: 2, percentage: 16.7 },
      ],
      cities: [], continents: [], regions: [],
    },
  },
  [`${P}/analytics/visitor-insights`]: {
    meta,
    data: {
      website_id: SITE_ID, date_range: '7d',
      visitor_insights: {
        new_visitors: 12, returning_visitors: 0,
        top_entry_pages: [{ page: '/menu', sessions: 3 }, { page: '/order/checkout', sessions: 3 }],
        top_exit_pages: [{ page: '/', sessions: 12 }],
      },
    },
  },
  [`${P}/analytics/custom-events`]: {
    meta,
    data: {
      website_id: SITE_ID,
      events: [{
        event_type: 'add_to_cart', count: 12, description: '', common_properties: {}, sample_properties: {}, sample_event: {},
        unique_visitors: 12, unique_sessions: 12, engagement_rate: 0, expected_properties: [], top_properties: {},
      }],
      top_events: [{
        event_type: 'add_to_cart', count: 12, description: '', common_properties: {}, sample_properties: {}, sample_event: {},
        unique_visitors: 12, unique_sessions: 12, engagement_rate: 0, expected_properties: [], top_properties: {},
      }],
      utm_performance: {
        sources: [{ source: 'newsletter', unique_visitors: 4, visits: 14 }],
        mediums: [], campaigns: [], terms: [], content: [],
        avg_ctr: 0, total_campaigns: 0, total_sources: 1, total_mediums: 0,
      },
      total_events: 1, total_occurrences: 12,
    },
  },
  [`${P}/analytics/goals-stats`]: {
    meta,
    data: {
      website_id: SITE_ID, date_range: '7d',
      goals: [{
        id: '7caaf5e8-24fc-4ed7-83de-3b8ee3262bfc', name: 'Checkout reached', goal_type: 'pageview', target: '/order/checkout',
        completions: 3, unique_visitors: 3, conversion_rate: 25,
      }],
    },
  },
  [`${P}/analytics/path-analysis`]: {
    meta,
    data: {
      website_id: SITE_ID, date_range: '7d',
      paths: [
        { page_1: '/about', page_2: '/order', page_3: '/menu', sessions: 3 },
        { page_1: '/menu', page_2: '/', page_3: null, sessions: 3 },
      ],
    },
  },
  [`${P}/analytics/page-utm-breakdown`]: {
    meta,
    data: {
      website_id: SITE_ID, date_range: '7d',
      breakdown: [
        { page: '/', utm_source: 'newsletter', utm_medium: null, utm_campaign: null, views: 4, unique_visitors: 4 },
        { page: '/menu', utm_source: 'newsletter', utm_medium: null, utm_campaign: null, views: 4, unique_visitors: 4 },
      ],
    },
  },
  [`${P}/analytics/live-visitors`]: {
    meta,
    data: {
      website_id: SITE_ID, live_visitors: 1, active_visitors: 3,
      visitors: [{
        visitor_id: 'v0', session_id: 's0', page: 'https://acme.yourapp.com/', country: 'US',
        browser: 'Safari 17.0', device: 'Desktop', last_seen: '2026-10-09T07:50:21.235Z',
      }],
    },
  },
  [`${P}/analytics/export`]: {
    meta,
    data: {
      website_id: SITE_ID, date_range: '31d', format: 'json', total: 54,
      data: [
        {
          event_type: 'add_to_cart', page: 'https://acme.yourapp.com/order', visitor_id: 'v0', session_id: 's0', referrer: null,
          country: 'US', city: null, browser: 'Safari 17.0', device: 'Desktop', os: 'macOS 14.0', language: null, utm_source: null,
        },
        {
          event_type: 'pageview', page: 'https://acme.yourapp.com/', visitor_id: 'v0', session_id: 's0', referrer: null,
          country: 'US', city: null, browser: 'Safari 17.0', device: 'Desktop', os: 'macOS 14.0', language: 'en-US', utm_source: 'newsletter',
        },
      ],
    },
  },
  [`${P}/analytics/events`]: {
    meta: { website_id: SITE_ID, limit: 100, offset: 0, returned: 54 },
    events: [
      {
        id: 'e9642651-d26f-42cb-9ec9-751f490b62c9', event_type: 'pageview', page: 'https://acme.yourapp.com/',
        visitor_id: 'v0', session_id: 's0', occurred_at: '2026-10-09T07:50:21.235Z',
        properties: { sh: 900, sw: 1440, lang: 'en-US', title: 'Home', referrer: '', utm_source: 'newsletter' },
      },
      {
        id: '76476457-738d-47b1-b504-d094557e5fb8', event_type: 'add_to_cart', page: 'https://acme.yourapp.com/order',
        visitor_id: 'v0', session_id: 's0', occurred_at: '2026-10-09T07:50:21.235Z',
        properties: { item: 'croissant' },
      },
    ],
  },
  [`${P}/sessions`]: {
    meta: { website_id: SITE_ID, limit: 50, offset: 0 },
    sessions: [{
      session_id: 's_8f2a1c', website_id: SITE_ID, browser: 'Chrome', device: 'Desktop', os: 'Windows', country: 'US',
      entry_page: '/menu', started_at: '2026-10-09T07:41:12.000Z', duration_seconds: 184, pages_viewed: 4,
      has_rage_clicks: false, has_errors: false,
    }],
  },
  [`${P}/heatmap/pages`]: {
    meta,
    pages: [{ page_path: '/', click_count: 12, scroll_count: 0, avg_scroll: 0, last_seen: '2026-10-09T07:50:21.327Z' }],
  },
  [`${P}/heatmap/points`]: {
    meta: { website_id: SITE_ID, page_path: '/', event_type: 'click' },
    points: [
      {
        page_path: '/', event_type: 'click', device_type: 'desktop', x_percent: 4000, y_percent: 3000, intensity: 1,
        target_selector: '', cap_vw: 1440, cap_vh: null, page_version: '', target_locator: null, target_rect: null,
      },
      {
        page_path: '/', event_type: 'click', device_type: 'desktop', x_percent: 4100, y_percent: 3000, intensity: 1,
        target_selector: '', cap_vw: 1440, cap_vh: null, page_version: '', target_locator: null, target_rect: null,
      },
    ],
  },
};
