/**
 * How numbers, changes and times read in every message: one place, so "fell 16%", "4,300",
 * "−6 pts" and "4m 12s" look the same on the dashboard, in an alert and in a session summary.
 */

/** A whole count with thousands separators: `4,300`. */
export const count = (n: number) => Math.round(n).toLocaleString('en-US');

/** A share already in percent: `38%`. */
export const share = (n: number) => `${Math.round(n)}%`;

/** A relative change as a signed percentage: `+25%`, `-16%`. */
export const signedPercent = (rel: number) => `${rel >= 0 ? '+' : '-'}${Math.round(Math.abs(rel) * 100)}%`;

/** A rate in percent, one decimal under 10: `4.2%`, `38%`. */
export const rateText = (r: number) => `${r.toFixed(r < 10 ? 1 : 0)}%`;

/** A ratio: `2.5×`. */
export const ratioText = (r: number) => `${(Math.round(r * 10) / 10).toFixed(1)}×`;

/** "rose" or "fell", for a signed change. */
export const direction = (rel: number) => (rel >= 0 ? 'rose' : 'fell');

/** "−6 pts", "+1.5 pts": a real minus sign, one decimal only when it says something. */
export function formatDelta(d: number): string {
  const abs = Math.abs(d);
  const text = abs < 10 && !Number.isInteger(abs) ? abs.toFixed(1) : String(Math.round(abs));
  return `${d < 0 ? '−' : '+'}${text} pts`;
}

/** First letter upper case. */
export const capitalize = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** `1 field`, `3 fields`. */
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Playback offset as the player shows it: `m:ss`, or `h:mm:ss` past an hour. */
export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m % 60).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** A length as people say it: `42s`, `4m 12s`, `1h 3m`. */
export function span(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 ? `${m}m ${s % 60}s` : `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
