/**
 * The date range an analytics read covers, as the API understands it.
 *
 * `days=N` is today plus the N−1 days before it, in the viewer's timezone; `days=0` is today
 * since local midnight. Anything that is not "the last N days, up to now" — Yesterday, a
 * custom range, the period before either — is sent as explicit local dates, `from`/`to`
 * (inclusive), which the server reads in the same timezone (core lib/analytics-window.ts).
 *
 * The dashboard used to send everything as `days`: Today as `days=0`, which the server
 * rejected and answered with each endpoint's own default; Yesterday as `days=1`, which is
 * today; a custom range as "the last N days ending now"; and the comparison period as twice
 * the range sliced by index, which broke on empty days and failed outright past 182 days.
 */

/** A range the API can read. A bare number is `days`, which is what most pages pass. */
export type DateRangeSpec = { days: number; from?: string; to?: string };
export type AnalyticsRange = number | DateRangeSpec;

const DAY_MS = 86_400_000;

export const toRangeSpec = (range: AnalyticsRange): DateRangeSpec =>
  typeof range === 'number' ? { days: range } : range;

/** The query parameters for a range. `days` goes too, for reads that only know it. */
export function rangeParams(range: AnalyticsRange): Record<string, string> {
  const r = toRangeSpec(range);
  const out: Record<string, string> = { days: String(r.days) };
  if (r.from) out.from = r.from;
  if (r.to) out.to = r.to;
  return out;
}

/** A stable cache-key part: the number itself for a plain `days`, so existing keys do not change. */
export function rangeKey(range: AnalyticsRange): number | string {
  const r = toRangeSpec(range);
  return r.from || r.to ? `${r.from ?? ''}..${r.to ?? ''}` : r.days;
}

/** A browser-local date as `YYYY-MM-DD` — the viewer's timezone, which is the one the API is sent. */
export function localISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** A local date moved by whole calendar days (by date, so a DST change cannot skip one). */
function shiftDate(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return localISODate(new Date(y!, m! - 1, d! + n));
}

/** Calendar days from `from` to `to`, inclusive. */
function daysBetween(from: string, to: string): number {
  const ms = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y!, m! - 1, d!);
  };
  return Math.round((ms(to) - ms(from)) / DAY_MS) + 1;
}

/**
 * The range a header preset means: 0 is today, 1 is yesterday (a whole day, explicitly — as
 * `days=1` it would be today), any other N the last N days up to now.
 */
export function presetRange(preset: number, now: Date = new Date()): DateRangeSpec {
  if (preset === 1) {
    const y = shiftDate(localISODate(now), -1);
    return { days: 1, from: y, to: y };
  }
  return { days: Math.max(0, preset) };
}

/** A picked range, both ends inclusive, as local dates — not "the last N days ending now". */
export function customRange(start: Date, end: Date): DateRangeSpec {
  let from = localISODate(start);
  let to = localISODate(end);
  if (from > to) [from, to] = [to, from];
  return { days: daysBetween(from, to), from, to };
}

/**
 * The period before a range, of the same number of days and ending the day before it starts —
 * as explicit dates, so it is read by itself instead of sliced out of a range twice as long.
 */
export function previousRange(range: AnalyticsRange, now: Date = new Date()): DateRangeSpec {
  const r = toRangeSpec(range);
  const today = localISODate(now);
  const from = r.from ?? shiftDate(today, -(Math.max(1, r.days) - 1));
  const to = r.to ?? today;
  const n = daysBetween(from, to);
  return { days: n, from: shiftDate(from, -n), to: shiftDate(from, -1) };
}
