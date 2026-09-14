/** Presentation helpers for error data. Pure, so components and fixtures share them. */

/** `TypeError: x is not a function` → `TypeError`, for the badge. */
export function errorTypeOf(message: string): string {
  const m = /^([A-Z][A-Za-z]*(?:Error|Exception))\b/.exec(message.trim());
  return m?.[1] ?? 'Error';
}

/**
 * Compact relative time — the list is scanned, not read.
 *
 * `now` is a parameter rather than a call to `Date.now()` so a recording can pin it.
 * A fixture dated "2d ago" in one render and "3d ago" in the next is exactly the drift
 * that makes a re-render differ from the take that was approved.
 */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const secs = Math.max(0, Math.round((now - then) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
