import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The analytics data layer.
 *
 * Two things carry real risk here. The formatters render every number on the dashboard,
 * so their boundaries are the boundaries of what a user sees. And the request builders
 * decide what window the server actually reports on — a dropped `days` parameter shows
 * seven days under a thirty-day heading, which looks like data loss rather than a bug.
 *
 * The axios instance is mocked at the module boundary so the URL and query string each
 * fetcher composes are directly observable.
 */

// `vi.mock` is hoisted above every `const` in the file, so the spy has to be created
// inside `vi.hoisted` to exist by the time the factory runs.
const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('@/lib/api', () => ({
  default: { get, post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('sonner', () => ({
  toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

import {
  analyticsKeys,
  formatDuration,
  formatNumber,
  formatPercentage,
  getDailyStats,
  getDashboardData,
  getDimensionsBulk,
  getHourlyStats,
  getLiveVisitors,
  getRealtimeData,
  getRealtimeGeoData,
  getTopPages,
  getUserTimezone,
  normalizeRecentActivityApiPayload,
} from '@/lib/analytics-api';

const SITE = 'ab12cd34';

/** The single URL the last call requested. */
function requestedUrl(): string {
  return get.mock.calls.at(-1)![0] as string;
}

function requestedParams(): URLSearchParams {
  return new URLSearchParams(requestedUrl().split('?')[1] ?? '');
}

beforeEach(() => {
  get.mockReset();
  get.mockResolvedValue({ data: {} });
});

// ─── Formatters ──────────────────────────────────────────────────────────────

describe('formatNumber', () => {
  it('leaves values below a thousand alone', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(7)).toBe('7');
    expect(formatNumber(999)).toBe('999');
  });

  it('abbreviates thousands to one decimal', () => {
    expect(formatNumber(1000)).toBe('1.0K');
    expect(formatNumber(1500)).toBe('1.5K');
    expect(formatNumber(12_345)).toBe('12.3K');
  });

  it('abbreviates millions to one decimal', () => {
    expect(formatNumber(1_000_000)).toBe('1.0M');
    expect(formatNumber(2_500_000)).toBe('2.5M');
  });

  it('never emits a four-digit K — 999,999 rolls over to M', () => {
    // The naive `>= 1e6 ? M : >= 1e3 ? K` ladder rounds 999,999 to "1000.0K", which is
    // both wrong-looking and wider than the tile it sits in.
    expect(formatNumber(999_999)).toBe('1.0M');
    expect(formatNumber(999_950)).toBe('1.0M');
  });

  it('keeps values just below the rollover in K', () => {
    expect(formatNumber(999_000)).toBe('999.0K');
    expect(formatNumber(999_400)).toBe('999.4K');
  });

  it('handles negatives without producing a bare minus', () => {
    expect(formatNumber(-5)).toBe('-5');
    expect(formatNumber(-1500)).toBe('-1.5K');
  });

  it('rounds rather than truncating', () => {
    expect(formatNumber(1_960)).toBe('2.0K');
  });

  it('abbreviates a negative in every tier, not just the sign', () => {
    expect(formatNumber(-1_500_000)).toBe('-1.5M');
    expect(formatNumber(-999_999)).toBe('-1.0M');
  });

  it('rolls over to B rather than emitting a four-digit M', () => {
    expect(formatNumber(1_000_000_000)).toBe('1.0B');
    expect(formatNumber(999_999_999)).toBe('1.0B');
    expect(formatNumber(999_000_000)).toBe('999.0M');
  });

  it('renders a non-finite count as 0 rather than "NaN"', () => {
    expect(formatNumber(NaN)).toBe('0');
    expect(formatNumber(Infinity)).toBe('0');
  });
});

describe('formatDuration', () => {
  it('renders seconds alone under a minute', () => {
    expect(formatDuration(1)).toBe('1s');
    expect(formatDuration(59)).toBe('59s');
  });

  it('renders minutes and seconds under an hour', () => {
    expect(formatDuration(60)).toBe('1m 0s');
    expect(formatDuration(184)).toBe('3m 4s');
    expect(formatDuration(3599)).toBe('59m 59s');
  });

  it('renders hours, minutes and seconds past an hour', () => {
    expect(formatDuration(3600)).toBe('1h 0m 0s');
    expect(formatDuration(7325)).toBe('2h 2m 5s');
  });

  it('renders zero and negatives as 0s rather than a negative duration', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(-30)).toBe('0s');
  });

  it('renders a missing or non-numeric duration as 0s', () => {
    // Session duration is absent on a site with no sessions; "NaNs" in a KPI tile
    // reads as a crash rather than as no data.
    expect(formatDuration(NaN)).toBe('0s');
    expect(formatDuration(undefined as unknown as number)).toBe('0s');
    expect(formatDuration(null as unknown as number)).toBe('0s');
  });

  it('truncates fractional seconds', () => {
    expect(formatDuration(90.9)).toBe('1m 30s');
  });
});

describe('formatPercentage', () => {
  it('renders one decimal place with a percent sign', () => {
    expect(formatPercentage(0)).toBe('0.0%');
    expect(formatPercentage(42.5)).toBe('42.5%');
    expect(formatPercentage(100)).toBe('100.0%');
  });

  it('rounds to one decimal', () => {
    expect(formatPercentage(33.333)).toBe('33.3%');
    expect(formatPercentage(66.666)).toBe('66.7%');
  });

  it('renders a negative rate with its sign', () => {
    expect(formatPercentage(-12.34)).toBe('-12.3%');
  });

  it('renders a non-finite rate as 0.0% rather than "NaN%"', () => {
    expect(formatPercentage(NaN)).toBe('0.0%');
    expect(formatPercentage(Infinity)).toBe('0.0%');
  });
});

// ─── Recent-activity normalisation ───────────────────────────────────────────

describe('normalizeRecentActivityApiPayload', () => {
  const row = {
    type: 'pageview',
    page: '/pricing',
    country: 'US',
    device: 'desktop',
    browser: 'Chrome',
    os: 'macOS',
    referrer: 'https://google.com',
    occurred_at: '2026-03-01T10:00:00.000Z',
  };

  it('reads rows from the `activity` key the API sends today', () => {
    const out = normalizeRecentActivityApiPayload({ activity: [row] });
    expect(out.activities).toHaveLength(1);
    expect(out.activities[0]).toEqual({
      page: '/pricing',
      country: 'US',
      device: 'desktop',
      browser: 'Chrome',
      os: 'macOS',
      referrer: 'https://google.com',
      timestamp: '2026-03-01T10:00:00.000Z',
    });
  });

  it('also reads rows from the legacy `activities` key', () => {
    expect(normalizeRecentActivityApiPayload({ activities: [row] }).activities).toHaveLength(1);
  });

  it('prefers `activity` when a payload carries both', () => {
    const out = normalizeRecentActivityApiPayload({
      activity: [row],
      activities: [{ ...row, page: '/legacy' }],
    });
    expect(out.activities[0]!.page).toBe('/pricing');
  });

  it('falls back to `timestamp` when there is no occurred_at', () => {
    const out = normalizeRecentActivityApiPayload({
      activity: [{ ...row, occurred_at: undefined, timestamp: '2026-03-01T09:00:00.000Z' }],
    });
    expect(out.activities[0]!.timestamp).toBe('2026-03-01T09:00:00.000Z');
  });

  it('renders every absent field as an empty string, never undefined', () => {
    // The feed passes these straight into helpers that call `.trim()` and `.startsWith()`.
    const out = normalizeRecentActivityApiPayload({ activity: [{ type: 'pageview' }] });
    expect(out.activities[0]).toEqual({
      page: '',
      country: '',
      device: '',
      browser: '',
      os: '',
      referrer: '',
      timestamp: '',
    });
  });

  it('keeps every event type when no rolling window was requested', () => {
    const out = normalizeRecentActivityApiPayload({
      activity: [row, { ...row, type: 'purchase' }],
    });
    expect(out.activities).toHaveLength(2);
  });

  it('keeps only pageviews when a rolling window was requested', () => {
    // The realtime panel is a pageview feed; a purchase row has no page to render.
    const out = normalizeRecentActivityApiPayload(
      { activity: [row, { ...row, type: 'purchase' }, { ...row, type: 'custom' }] },
      30,
    );
    expect(out.activities).toHaveLength(1);
    expect(out.activities[0]!.page).toBe('/pricing');
  });

  it('does not filter for a zero or negative window', () => {
    expect(
      normalizeRecentActivityApiPayload({ activity: [{ ...row, type: 'purchase' }] }, 0).activities,
    ).toHaveLength(1);
  });

  it('returns an empty list rather than throwing for a malformed payload', () => {
    for (const raw of [{}, { activity: null }, { activity: 'nope' }, []]) {
      expect(normalizeRecentActivityApiPayload(raw).activities).toEqual([]);
    }
  });

  it('coerces non-string field values instead of leaking them through', () => {
    const out = normalizeRecentActivityApiPayload({ activity: [{ ...row, page: 123 }] });
    expect(out.activities[0]!.page).toBe('123');
  });
});

// ─── Request construction ────────────────────────────────────────────────────

describe('request building', () => {
  it('sends days and timezone on the dashboard read', async () => {
    await getDashboardData(SITE, 30);
    expect(requestedUrl()).toContain(`/analytics/dashboard/${SITE}`);
    expect(requestedParams().get('days')).toBe('30');
    expect(requestedParams().get('timezone')).toBe(getUserTimezone());
  });

  it('defaults the dashboard window to seven days', async () => {
    await getDashboardData(SITE);
    expect(requestedParams().get('days')).toBe('7');
  });

  it('appends active filters and drops empty ones', async () => {
    // An empty filter must not become `country=`, which the server would have to
    // treat as a real value.
    await getTopPages(SITE, 7, { country: 'US', device: '' } as never);
    const params = requestedParams();
    expect(params.get('country')).toBe('US');
    expect(params.has('device')).toBe(false);
  });

  it('sends days and timezone on the bulk dimensions read', async () => {
    await getDimensionsBulk(SITE, 14);
    expect(requestedUrl()).toContain(`/analytics/dimensions-bulk/${SITE}`);
    expect(requestedParams().get('days')).toBe('14');
  });

  it('defaults daily stats to thirty days, matching the server default', async () => {
    await getDailyStats(SITE);
    expect(requestedParams().get('days')).toBe('30');
  });

  it('sends the rolling window on the realtime geo read', async () => {
    get.mockResolvedValue({ data: { visitors: [] } });
    await getRealtimeGeoData(SITE, 60);
    expect(requestedUrl()).toContain(`/analytics/realtime-geo/${SITE}`);
    expect(requestedParams().get('within_minutes')).toBe('60');
  });

  it('defaults the realtime geo window to thirty minutes', async () => {
    get.mockResolvedValue({ data: { visitors: [] } });
    await getRealtimeGeoData(SITE);
    expect(requestedParams().get('within_minutes')).toBe('30');
  });

  it('sends no window on the realtime read — the server fixes it', async () => {
    get.mockResolvedValue({ data: {} });
    await getRealtimeData(SITE);
    expect(requestedUrl()).toContain(`/analytics/realtime/${SITE}`);
    expect(requestedParams().has('days')).toBe(false);
  });

  it('reads the live-visitor count and falls back to zero', async () => {
    get.mockResolvedValue({ data: { live_visitors: 12 } });
    expect(await getLiveVisitors(SITE)).toBe(12);

    get.mockResolvedValue({ data: {} });
    expect(await getLiveVisitors(SITE)).toBe(0);

    get.mockResolvedValue({ data: { live_visitors: null } });
    expect(await getLiveVisitors(SITE)).toBe(0);
  });
});

// ─── Hourly scaffold ─────────────────────────────────────────────────────────

describe('getHourlyStats', () => {
  it('pads a sparse response out to all twenty-four hours', async () => {
    // The server returns only hours that had traffic; a chart missing 03:00 draws a
    // straight line across the small hours instead of a trough.
    get.mockResolvedValue({
      data: { hourly_stats: [{ hour: 9, views: 12, unique: 8 }] },
    });
    const out = await getHourlyStats(SITE);

    expect(out.hourly_stats).toHaveLength(24);
    expect(out.hourly_stats.map((h) => h.hour)).toEqual([...Array(24).keys()]);
  });

  it('places the reported hour at its own index and zeroes the rest', async () => {
    get.mockResolvedValue({ data: { hourly_stats: [{ hour: 9, views: 12, unique: 8 }] } });
    const out = await getHourlyStats(SITE);

    expect(out.hourly_stats[9]).toMatchObject({ hour: 9, views: 12, unique: 8 });
    expect(out.hourly_stats[0]).toMatchObject({ hour: 0, views: 0, unique: 0 });
    expect(out.hourly_stats.filter((h) => h.views > 0)).toHaveLength(1);
  });

  it('labels every hour zero-padded', async () => {
    get.mockResolvedValue({ data: { hourly_stats: [] } });
    const out = await getHourlyStats(SITE);
    expect(out.hourly_stats[0]!.hour_label).toBe('00:00');
    expect(out.hourly_stats[9]!.hour_label).toBe('09:00');
    expect(out.hourly_stats[23]!.hour_label).toBe('23:00');
  });

  it('accepts an hour returned as a string', async () => {
    get.mockResolvedValue({ data: { hourly_stats: [{ hour: '14', views: 5, unique: 4 }] } });
    const out = await getHourlyStats(SITE);
    expect(out.hourly_stats[14]).toMatchObject({ hour: 14, views: 5, unique: 4 });
  });

  it('scaffolds a full day even when the site had no traffic at all', async () => {
    get.mockResolvedValue({ data: { hourly_stats: [] } });
    const out = await getHourlyStats(SITE);
    expect(out.hourly_stats).toHaveLength(24);
    expect(out.hourly_stats.every((h) => h.views === 0)).toBe(true);
  });

  it('leaves a payload without the key untouched rather than inventing one', async () => {
    get.mockResolvedValue({ data: { error: 'nope' } });
    const out = (await getHourlyStats(SITE)) as unknown as Record<string, unknown>;
    expect(out.hourly_stats).toBeUndefined();
  });
});

// ─── Demo mode ───────────────────────────────────────────────────────────────

describe('demo mode', () => {
  it('serves the dashboard from fixtures without touching the network', async () => {
    const out = await getDashboardData('demo');
    expect(get).not.toHaveBeenCalled();
    expect(out).toBeDefined();
  });

  it('serves realtime, top pages and bulk dimensions from fixtures too', async () => {
    await getRealtimeData('demo');
    await getTopPages('demo');
    await getDimensionsBulk('demo');
    expect(get).not.toHaveBeenCalled();
  });

  it('shapes the demo bulk payload like the real endpoint', async () => {
    const out = await getDimensionsBulk('demo', 14);
    expect(out.website_id).toBe('demo');
    expect(out.date_range).toBe('14d');
    for (const key of ['top_pages', 'top_referrers', 'top_countries', 'top_browsers', 'top_devices', 'top_os'] as const) {
      expect(Array.isArray(out[key])).toBe(true);
    }
  });
});

// ─── Query keys ──────────────────────────────────────────────────────────────

describe('analyticsKeys', () => {
  it('varies the key by website and window so two views cannot share a cache entry', () => {
    const a = JSON.stringify(analyticsKeys.visitorInsights('site_a', 7));
    const b = JSON.stringify(analyticsKeys.visitorInsights('site_a', 30));
    const c = JSON.stringify(analyticsKeys.visitorInsights('site_b', 7));

    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it('is stable across calls with the same arguments', () => {
    expect(analyticsKeys.visitorInsights('site_a', 7)).toEqual(
      analyticsKeys.visitorInsights('site_a', 7),
    );
  });

  it('shares a common prefix so the whole namespace can be invalidated at once', () => {
    expect(analyticsKeys.visitorInsights('site_a', 7).slice(0, analyticsKeys.all.length)).toEqual(
      analyticsKeys.all,
    );
  });
});

// ─── Timezone ────────────────────────────────────────────────────────────────

describe('getUserTimezone', () => {
  it('returns a resolvable IANA zone', () => {
    const tz = getUserTimezone();
    expect(typeof tz).toBe('string');
    expect(tz.length).toBeGreaterThan(0);
    expect(() => Intl.DateTimeFormat(undefined, { timeZone: tz })).not.toThrow();
  });

  it('falls back to UTC when the platform cannot resolve one', () => {
    const original = Intl.DateTimeFormat;
    // @ts-expect-error deliberately breaking the global for this assertion
    Intl.DateTimeFormat = () => {
      throw new Error('no ICU');
    };
    try {
      expect(getUserTimezone()).toBe('UTC');
    } finally {
      Intl.DateTimeFormat = original;
    }
  });
});
