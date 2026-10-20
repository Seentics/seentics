import { errorsEn, type ErrorsMessages } from '@/lib/i18n/messages/errors-en';
import type { ErrorGroup } from './types';

export type ErrorGroupId = 'new' | 'worse' | 'key_pages' | 'better' | 'noisy';

/**
 * The groups the error list is browsed by, in the order shown. Labels and descriptions are in
 * the `errors` messages (`buckets[id]`, `bucketHints[id]`).
 */
export const ERROR_GROUP_META: Array<{ id: ErrorGroupId; dot: string }> = [
  { id: 'new',       dot: 'bg-red-500' },
  { id: 'worse',     dot: 'bg-orange-500' },
  { id: 'key_pages', dot: 'bg-red-500' },
  { id: 'better',    dot: 'bg-emerald-500' },
  { id: 'noisy',     dot: 'bg-muted-foreground' },
];

/** Messages browsers and extensions raise that almost never break a page. */
const HARMLESS = /ResizeObserver loop|^Script error\.?$|Non-Error promise rejection|chrome-extension:|moz-extension:|safari-extension:|AbortError|The operation was aborted|Load failed$|cancelled$/i;
const KEY_PAGE = /\/(checkout|cart|pay|payment|signup|sign-up|register|login|subscribe|billing)\b/i;

export function inErrorGroup(g: ErrorGroup, id: ErrorGroupId, periodStart: number): boolean {
  const w = g.window;
  const noisy = HARMLESS.test(g.message);
  switch (id) {
    case 'new': return new Date(g.first_seen).getTime() >= periodStart && !noisy;
    case 'worse': return !!w && w.count >= 10 && (w.prev_count === 0 ? new Date(g.first_seen).getTime() < periodStart : w.count >= 2 * w.prev_count) && !noisy;
    case 'key_pages': return !noisy && [...(w?.pages ?? []), g.last_page_path].some((p) => KEY_PAGE.test(p));
    case 'better': return !!w && w.prev_count >= 10 && w.count * 2 <= w.prev_count;
    case 'noisy': return noisy;
  }
}

/** One line saying what an error is doing in the period, in plain words. */
export function errorLine(
  g: ErrorGroup, periodStart: number, periodLabel: string, t: ErrorsMessages['line'] = errorsEn.line,
): string {
  const w = g.window;
  const times = (n: number) => t.times(n.toLocaleString('en-US'), n === 1);
  if (HARMLESS.test(g.message)) {
    return `${t.harmless}${w ? ` · ${times(w.count)} ${periodLabel}` : ''}`;
  }
  if (!w) return g.last_page_path ? t.on(g.last_page_path) : '';
  const isNew = new Date(g.first_seen).getTime() >= periodStart;
  const where = w.pages.length ? t.onPages(w.pages.slice(0, 2)) : '';
  const who = w.sessions > 0 ? t.affected(w.sessions.toLocaleString('en-US'), w.sessions === 1) : '';
  const trend = isNew
    ? t.new
    : w.prev_count === 0 && w.count > 0
      ? t.backAgain
      : w.count >= 2 * w.prev_count && w.count >= 10
        ? t.upFrom(w.prev_count.toLocaleString('en-US'))
        : w.count * 2 <= w.prev_count
          ? t.downFrom(w.prev_count.toLocaleString('en-US'))
          : t.steady;
  if (w.count === 0) return t.notSeen(periodLabel);
  return t.full(trend, times(w.count), where, periodLabel, who);
}

/** The list's groups: each error under exactly one, the most pressing it is in. */
export type ErrorBucket = ErrorGroupId | 'steady';
export const ERROR_BUCKETS: Array<{ id: ErrorBucket; dot: string }> = [
  ...ERROR_GROUP_META.filter((g) => g.id !== 'better' && g.id !== 'noisy'),
  { id: 'steady', dot: 'bg-muted-foreground/70' },
  ...ERROR_GROUP_META.filter((g) => g.id === 'better' || g.id === 'noisy'),
];

export function errorBucket(g: ErrorGroup, periodStart: number): ErrorBucket {
  // Harmless first: a browser warning that is "new" is still not worth a look.
  if (inErrorGroup(g, 'noisy', periodStart)) return 'noisy';
  const order: ErrorGroupId[] = ['new', 'worse', 'key_pages', 'better'];
  return order.find((id) => inErrorGroup(g, id, periodStart)) ?? 'steady';
}
