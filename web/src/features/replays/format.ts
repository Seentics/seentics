/**
 * Pure formatting for replay sessions.
 *
 * Lifted out of the page: none of it touches React, and the session list, the player
 * header and any future export all want the same `4m 12s` and the same entry-path
 * shortening rather than three near-identical copies.
 *
 * `now` is a parameter on `timeAgo` so a caller can pin the clock — the page read
 * `Date.now()` on every render, which makes a rendered row impossible to compare
 * against itself in a test.
 */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

export function timeAgo(iso: string, now: number = Date.now()): string {
  const m = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Strip origin; keep path (+ query). Truncate for table cells; tooltip shows full path. */
const ENTRY_PATH_MAX = 56;

/** Drop redundant `/websites/{id}/` when entry URLs are recorded as dashboard routes. */
export function stripWebsiteDashboardPrefix(path: string, websiteId: string): string {
  if (!websiteId) return path;
  const prefix = `/websites/${websiteId}`;
  if (path === prefix || path === `${prefix}/`) return '/';
  if (path.startsWith(`${prefix}/`)) return path.slice(prefix.length);
  return path;
}

export function entryPathDisplay(raw: string, websiteId: string): { display: string; title: string } {
  const t = raw?.trim() || '/';
  let path = t;
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t) || t.startsWith('//')) {
      const u = new URL(t.startsWith('//') ? `https:${t}` : t);
      path = `${u.pathname}${u.search}` || '/';
    }
  } catch {
    /* treat as plain path */
  }
  if (!path.startsWith('/')) path = `/${path}`;

  const title = path;
  const relative = stripWebsiteDashboardPrefix(path, websiteId);
  const display =
    relative.length <= ENTRY_PATH_MAX
      ? relative
      : `${relative.slice(0, ENTRY_PATH_MAX - 1)}…`;
  return { display, title };
}

/** Device classes the server will filter on. */
type DeviceFilter = 'all' | 'desktop' | 'mobile' | 'tablet';

/**
 * How long to wait after the last keystroke before searching.
 *
 * The search runs on the server now, so every character would otherwise be a query
 * against a table that grows without bound.
 */

