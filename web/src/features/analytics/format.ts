/**
 * Pure presentation and timing helpers for analytics.
 *
 * No React and no transport, so a component, a test and a fixture can all share them.
 */
import type { HourlyStat } from './types';

/** Returns the user's IANA timezone (e.g. "Asia/Dhaka", "America/New_York") */
export const getUserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
};

/**
 * How often a windowed dashboard read should refresh, given the window it covers.
 *
 * A flat 30s was applied to every range, so a 30-day view re-ran a month-wide aggregate
 * twice a minute — per open tab, per viewer — to redraw numbers that cannot visibly move
 * in that time. On a dashboard left open all day that is thousands of recomputes against
 * a database that also has the ingest write path to serve, and the slowness it causes is
 * felt by the same person who left the tab open.
 *
 * Short windows still refresh quickly, because there the movement is the point.
 */
export function dashboardRefreshMs(days: number): number {
  if (days <= 1) return 30_000;
  if (days <= 7) return 5 * 60_000;
  return 15 * 60_000;
}

/**
 * Abbreviate a count for a KPI tile.
 *
 * Two things the obvious ladder gets wrong. It compares against the tier floor rather
 * than against the *rounded* result, so 999,999 renders as "1000.0K" — four digits and
 * a K, wider than the tile and a tier behind where it belongs. And it tests `num`
 * rather than its magnitude, so every negative falls through unabbreviated: -1,500,000
 * came out as "-1500000".
 *
 * Thresholds are therefore the point at which `toFixed(1)` would round up into the next
 * tier (999,950 → "1.0M"), and the sign is carried separately from the magnitude.
 */
export const formatNumber = (num: number): string => {
  if (!Number.isFinite(num)) return '0';

  const sign = num < 0 ? '-' : '';
  const abs = Math.abs(num);

  if (abs >= 999_999_950) return `${sign}${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 999_950) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}K`;
  return num.toString();
};

// Helper function to format duration (seconds to human readable)
export const formatDuration = (seconds: number): string => {
  // Handle invalid or zero values
  if (!seconds || seconds <= 0) {
    return '0s';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
};

/**
 * Render a rate for a KPI tile.
 *
 * Guarded like {@link formatDuration}: a bounce rate is absent on a site with no
 * sessions, and "NaN%" in a tile reads as a crash rather than as no data.
 */
export const formatPercentage = (value: number): string => {
  if (!Number.isFinite(value)) return '0.0%';
  return `${value.toFixed(1)}%`;
};

/**
 * Reshape the recent-activity payload into the flat rows the feed renders.
 *
 * Exported for its own tests. It absorbs three separate variations the server has
 * shipped — rows under `activity` or `activities`, and a timestamp under `occurred_at`
 * or `timestamp` — and it drops non-pageview rows whenever a rolling window was
 * requested. None of that is observable from the hook without a query client.
 */
export function normalizeRecentActivityApiPayload(
  raw: unknown,
  withinMinutes?: number,
): { activities: Array<{
  page: string;
  country: string;
  device: string;
  browser: string;
  os: string;
  referrer: string;
  timestamp: string;
}> } {
  const o = raw as Record<string, unknown>;
  const rows = Array.isArray(o.activity)
    ? (o.activity as Record<string, unknown>[])
    : Array.isArray(o.activities)
      ? (o.activities as Record<string, unknown>[])
      : [];
  const filtered =
    typeof withinMinutes === 'number' && withinMinutes > 0
      ? rows.filter((r) => r.type === 'pageview')
      : rows;
  return {
    activities: filtered.map((r) => ({
      page: String(r.page ?? ''),
      country: String(r.country ?? ''),
      device: String(r.device ?? ''),
      browser: String(r.browser ?? ''),
      os: String(r.os ?? ''),
      referrer: String(r.referrer ?? ''),
      timestamp: String(r.occurred_at ?? r.timestamp ?? ''),
    })),
  };
}
