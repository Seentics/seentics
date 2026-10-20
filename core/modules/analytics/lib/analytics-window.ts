/**
 * The time window of an analytics read, resolved once from its query string.
 *
 * Every endpoint used to work out its own window from `days`, and they disagreed: the
 * raw-event reads counted back `days × 24h` from now, the rollups whole UTC days, the
 * daily chart local days. `days=0` ("Today" in the dashboard) failed `parseDays` and each
 * endpoint fell back to a different default, and there was no way to ask for yesterday,
 * a custom range, or the period before one — so the comparison overlay fetched twice the
 * range and sliced it by index, which broke on every empty day.
 *
 * One window now, in the viewer's timezone:
 *
 * - `days=N` is today plus the N−1 local days before it, up to now. `days=0` and `days=1`
 *   are both today: since local midnight.
 * - `from`/`to` are an explicit range. A date (`2026-10-19`) is that whole local day — `to`
 *   is inclusive — and an ISO timestamp is that instant. The end never runs past now.
 * - The previous period starts the same number of local days earlier and is exactly as
 *   long, so at 09:00 "today" is set against yesterday until 09:00, not all of yesterday.
 *
 * Bounds are half-open, `[start, end)`.
 */

const DAY_MS = 86_400_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
/** Longest explicit range: three years, so a previous-period read of a full year still fits. */
export const MAX_RANGE_DAYS = 1100;

export type AnalyticsSpan = {
  /** ISO bounds of the window, `[start, end)`. */
  start: string;
  end: string;
  /** ISO bounds of the comparison period, `[prevStart, prevEnd)`. */
  prevStart: string;
  prevEnd: string;
  /** Local calendar days the window touches, at least 1. */
  days: number;
  /** The IANA zone the window's days are in (already sanitised). */
  tz: string;
  /** First and last local date in the window, inclusive — what a daily chart draws. */
  fromDate: string;
  toDate: string;
  /**
   * First and last UTC day for the daily rollups, inclusive. Those are kept per UTC day, so a
   * local window reads the UTC days most of which fall inside it — the same rule the dashboard
   * totals use for legacy rows — and always at least the day the window ends on.
   */
  fromDay: string;
  toDay: string;
  /** Whether the range came from `from`/`to` rather than `days`. */
  explicit: boolean;
};

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = partsFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    if (partsFormatters.size > 200) partsFormatters.clear();
    partsFormatters.set(tz, f);
  }
  return f;
}

/** The wall-clock fields of `ms` in `tz`. */
function wallClock(ms: number, tz: string) {
  const p: Record<string, number> = {};
  for (const part of formatter(tz).formatToParts(new Date(ms))) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  return p as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** How far `tz` is ahead of UTC at the instant `ms`. */
function offsetMs(ms: number, tz: string): number {
  const w = wallClock(ms, tz);
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - Math.floor(ms / 1000) * 1000;
}

/** The local date (`YYYY-MM-DD`) of an instant. */
export function localDate(ms: number, tz: string): string {
  const w = wallClock(ms, tz);
  return `${w.year}-${String(w.month).padStart(2, "0")}-${String(w.day).padStart(2, "0")}`;
}

/** The instant a local date begins in `tz`. Re-checked once, so a DST change that day is honoured. */
export function zonedMidnight(date: string, tz: string): number {
  const guess = Date.parse(`${date}T00:00:00Z`);
  const first = guess - offsetMs(guess, tz);
  const second = guess - offsetMs(first, tz);
  return second;
}

/** A `YYYY-MM-DD` date moved by whole days. */
export function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/** Local dates from `from` to `to`, inclusive. */
export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length <= MAX_RANGE_DAYS; d = addDays(d, 1)) out.push(d);
  return out;
}

function isRealDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const ms = Date.parse(`${s}T00:00:00Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === s;
}

/** A `from`/`to` value as an instant: a date's local midnight (the day after it, for `to`), or an ISO timestamp. */
function parseBound(raw: string | undefined, tz: string, isEnd: boolean): { ms: number; date: boolean } | null {
  const s = raw?.trim();
  if (!s) return null;
  if (isRealDate(s)) return { ms: zonedMidnight(isEnd ? addDays(s, 1) : s, tz), date: true };
  if (ISO_RE.test(s)) {
    const ms = Date.parse(s);
    return Number.isFinite(ms) ? { ms, date: false } : null;
  }
  return null;
}

/** The UTC days of the daily rollups a window reads; see `AnalyticsSpan.fromDay`. */
function rollupDays(startMs: number, endMs: number): { fromDay: string; toDay: string } {
  const toDay = new Date(endMs - 1).toISOString().slice(0, 10);
  // The first UTC day whose noon is inside the window.
  const noonFirst = Math.ceil((startMs - DAY_MS / 2) / DAY_MS) * DAY_MS;
  const fromDay = new Date(noonFirst).toISOString().slice(0, 10);
  return { fromDay: fromDay > toDay ? toDay : fromDay, toDay };
}

/**
 * The window a query asks for. `days` falls back to `defaultDays` when it is missing or bad
 * (`parseDays`' rules, plus 0 for today); an invalid, reversed or over-long `from`/`to` is
 * ignored in favour of `days` rather than answered with a 400, like every other bad parameter.
 */
export function resolveSpan(
  query: { days?: string; from?: string; to?: string },
  tz: string,
  defaultDays = 7,
  now = Date.now(),
): AnalyticsSpan {
  const from = parseBound(query.from, tz, false);
  const to = parseBound(query.to, tz, true);
  if (from) {
    const endMs = Math.min(to?.ms ?? now, now);
    if (endMs > from.ms && endMs - from.ms <= MAX_RANGE_DAYS * DAY_MS) {
      return spanOf(from.ms, endMs, tz, true, from.date);
    }
  }
  const days = parseSpanDays(query.days, defaultDays);
  const fromDate = addDays(localDate(now, tz), -(days - 1));
  return spanOf(zonedMidnight(fromDate, tz), now, tz, false, true);
}

/** `days` as a count of local days: 0 is today, like 1; otherwise `parseDays`' range. */
function parseSpanDays(raw: string | undefined, def: number): number {
  const n = Number(raw ?? def);
  if (!Number.isFinite(n) || raw?.trim() === "") return def;
  if (n >= 0 && n < 1) return 1;
  return n >= 1 && n < 366 ? Math.floor(n) : def;
}

function spanOf(startMs: number, endMs: number, tz: string, explicit: boolean, dayAligned: boolean): AnalyticsSpan {
  const fromDate = localDate(startMs, tz);
  const toDate = localDate(endMs - 1, tz);
  const days = datesBetween(fromDate, toDate).length;
  const len = endMs - startMs;
  // A window that starts at a local midnight is compared with the one starting as many local
  // days earlier; one that starts at an arbitrary instant with the span just before it.
  const prevStartMs = dayAligned ? zonedMidnight(addDays(fromDate, -days), tz) : startMs - len;
  return {
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
    prevStart: new Date(prevStartMs).toISOString(),
    prevEnd: new Date(Math.min(prevStartMs + len, startMs)).toISOString(),
    days,
    tz,
    fromDate,
    toDate,
    ...rollupDays(startMs, endMs),
    explicit,
  };
}
