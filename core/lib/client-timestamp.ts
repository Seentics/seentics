/** Client-clock sanity window: reject anything older than 48h or more than 5min in the future. */
const MAX_PAST_MS = 48 * 60 * 60 * 1000;
const MAX_FUTURE_MS = 5 * 60 * 1000;

/**
 * Clamp a client-supplied epoch-ms timestamp. Client clocks (and seconds-vs-ms mistakes,
 * or outright forged values) produce 1970 dates and corrupt dashboards/retention — accept
 * the value only when it falls within [now − 48h, now + 5min], otherwise use server now.
 */
export function clampClientTs(ts: number, now: number = Date.now()): number {
  if (!Number.isFinite(ts)) return now;
  if (ts < now - MAX_PAST_MS || ts > now + MAX_FUTURE_MS) return now;
  return ts;
}
