/**
 * The insight card's per-day, per-website view state, and the link an evidence chip
 * points at. Pure, so it is testable without rendering the card.
 */

const DISMISS_PREFIX = 'seentics:insights-dismissed:';
const COLLAPSE_PREFIX = 'seentics:insights-collapsed:';

/** Today in the visitor's own calendar, as `YYYY-MM-DD`. */
export function localDay(now = new Date()): string {
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

/**
 * Dismissal is for one insight, not forever: the day it was dismissed for is stored, and
 * the card comes back when there is a newer one (or a new day with none).
 */
export function isDismissed(websiteId: string, day: string): boolean {
  try {
    return localStorage.getItem(DISMISS_PREFIX + websiteId) === day;
  } catch {
    return false;
  }
}

export function dismiss(websiteId: string, day: string): void {
  try { localStorage.setItem(DISMISS_PREFIX + websiteId, day); } catch { /* best effort */ }
}

/** Collapsed stays collapsed across days — it is a layout preference, not a reaction to one insight. */
export function isCollapsed(websiteId: string): boolean {
  try {
    return localStorage.getItem(COLLAPSE_PREFIX + websiteId) === '1';
  } catch {
    return false;
  }
}

export function setCollapsed(websiteId: string, collapsed: boolean): void {
  try {
    if (collapsed) localStorage.setItem(COLLAPSE_PREFIX + websiteId, '1');
    else localStorage.removeItem(COLLAPSE_PREFIX + websiteId);
  } catch { /* best effort */ }
}

/**
 * Where an evidence chip links, or `null` when it should not be a link.
 *
 * `''` is the overview, which is the page the card is on. Anything that is not a plain
 * relative path under the website — a scheme, `//host`, `..` — is refused: the path comes
 * from a model's output, and a link is the one place it could send someone elsewhere.
 */
export function evidenceHref(websiteId: string, path: string | null | undefined): string | null {
  const p = (path ?? '').trim().replace(/^\/+/, '');
  if (!p) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(p) || p.includes('..') || p.includes('\\') || p.startsWith('/')) return null;
  if (!/^[\w\-./?=&%:,+~]+$/.test(p)) return null;
  return `/websites/${websiteId}/${p}`;
}
