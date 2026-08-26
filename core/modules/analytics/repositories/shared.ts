/**
 * Query helpers shared by the analytics repositories.
 *
 * Note what is *not* here: website reference resolution. Each analytics query
 * used to call `resolveSiteId`, which reads the `websites` table — analytics
 * reaching directly into another module's storage, and a redundant lookup on
 * every request. Resolution now happens once at the service boundary through the
 * injected `WebsiteQuery` interface, and repositories receive an already-resolved
 * `websiteId`.
 */

/**
 * Clamp a `days` query parameter to a sane window.
 *
 * Anything unparseable, non-positive, or beyond a year falls back to `def`
 * rather than erroring — these arrive from dashboard URLs, where a bad value
 * should render the default range instead of a 400.
 */
export function parseDays(raw: string | undefined, def = 7): number {
  const n = Number(raw ?? def);
  return Number.isFinite(n) && n > 0 && n < 366 ? Math.floor(n) : def;
}

/**
 * Validate an IANA timezone, falling back to UTC.
 *
 * The value is interpolated into `AT TIME ZONE` clauses, so it is checked
 * against a character whitelist first and then handed to `Intl` to confirm the
 * zone actually exists. Skipping either check turns a query parameter into
 * either an injection vector or a Postgres 22023 error.
 */
export function sanitizeTimezone(tz: string | undefined): string {
  if (!tz || typeof tz !== "string") return "UTC";
  if (!/^[A-Za-z0-9_+\-/]+$/.test(tz)) return "UTC";
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

/** Clamp a `limit` query parameter. */
export function parseLimit(raw: string | undefined, def = 50, max = 500): number {
  const n = Number(raw ?? def);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(Math.floor(n), max);
}

/** ISO timestamp `days` before now — the start bound for a window query. */
export function windowStartIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

/** Normalise a timestamp column to an ISO string, whatever the driver returned. */
export function occurredAtToIso(v: Date | string): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return new Date(v).toISOString();
  return new Date(0).toISOString();
}

/** Placeholder for a dimension value the tracker did not send. */
export const NOT_SET = "(not set)";

/** Collapse an empty or whitespace-only dimension value to `NOT_SET`. */
export function orNotSet(value: string | null | undefined): string {
  return value?.trim() ? value : NOT_SET;
}
