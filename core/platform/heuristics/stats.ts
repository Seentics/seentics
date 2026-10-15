/**
 * The statistics every heuristic is built on: robust baselines, significance, change.
 *
 * Pure functions over plain numbers. The anomaly checks, impact readings, insight signals and
 * heatmap findings all decide "is this real, and how big" with these, so one test suite covers
 * the maths behind every message Seentics writes.
 */

/** Middle value; the mean of the two middle ones for an even count. `0` for none. */
export function median(values: readonly number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/**
 * A robust baseline from past readings (same hour in past weeks, say).
 *
 * Median and median absolute deviation, so one odd week does not move it. The scale has two
 * floors: Poisson noise (√median) for small counts, and 10% of the median so a perfectly flat
 * history does not turn every wobble into an alarm.
 */
export type Baseline = { values: number[]; median: number; mad: number; scale: number };

export function baseline(values: readonly number[]): Baseline {
  const clean = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const m = median(clean);
  const mad = median(clean.map((v) => Math.abs(v - m)));
  return { values: clean, median: m, mad, scale: Math.max(1.4826 * mad, Math.sqrt(Math.max(m, 1)), 0.1 * m) };
}

/** How many baseline scales an observation sits from the median. */
export const zScore = (observed: number, b: Baseline) => (observed - b.median) / b.scale;

/**
 * Two-proportion z-test: did the rate x2/n2 differ from x1/n1 by more than chance? Positive when
 * it rose. `null` when either side has no volume or there is no variance to measure against.
 */
export function twoProportionZ(x1: number, n1: number, x2: number, n2: number): number | null {
  if (n1 <= 0 || n2 <= 0) return null;
  const p1 = x1 / n1;
  const p2 = x2 / n2;
  const pooled = (x1 + x2) / (n1 + n2);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
  if (!(se > 0)) return null;
  return Math.round(((p2 - p1) / se) * 100) / 100;
}

/** Relative change from `prev` to `cur` (0.25 = up 25%). `null` when there was nothing before. */
export const relativeChange = (p: { cur: number; prev: number }): number | null => (p.prev > 0 ? (p.cur - p.prev) / p.prev : null);

/** A share as a percentage, to one decimal place. `null` with no volume. */
export function percentOf(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
}

export const round1 = (n: number) => Math.round(n * 10) / 10;
