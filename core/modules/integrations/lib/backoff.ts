/**
 * When a failed delivery is tried again.
 *
 * Six attempts in all, spread over about seven and a half hours: long enough to ride out an
 * outage at the destination, short enough that a lead is not left in limbo for days. The first
 * retry is quick because most failures are a blip.
 */
export const RETRY_DELAYS_MS = [30_000, 2 * 60_000, 10 * 60_000, 60 * 60_000, 6 * 60 * 60_000] as const;
export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;

/** Milliseconds to wait before the next attempt, or `null` when `attemptsMade` used the budget up. */
export function retryDelayMs(attemptsMade: number): number | null {
  if (attemptsMade >= MAX_ATTEMPTS) return null;
  return RETRY_DELAYS_MS[Math.max(0, attemptsMade - 1)]!;
}

/** A connection is switched off after this many leads in a row gave up (each already retried). */
export const DISABLE_AFTER_FAILURES = 5;
