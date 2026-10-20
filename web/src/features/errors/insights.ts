import type { ErrorGroup } from './types';

export type ErrorGroupId = 'new' | 'worse' | 'key_pages' | 'better' | 'noisy';

/** The groups the error list is browsed by, in the order shown. */
export const ERROR_GROUP_META: Array<{ id: ErrorGroupId; label: string; description: string; dot: string }> = [
  { id: 'new',       label: 'New',                     description: 'First seen in this period',                  dot: 'bg-red-500' },
  { id: 'worse',     label: 'Getting worse',           description: 'At least twice as often as the period before', dot: 'bg-orange-500' },
  { id: 'key_pages', label: 'On checkout or signup',   description: 'Hitting the pages that make money',          dot: 'bg-red-500' },
  { id: 'better',    label: 'Calming down',            description: 'Less than half as often as before',          dot: 'bg-emerald-500' },
  { id: 'noisy',     label: 'Noisy but harmless',      description: 'Browser warnings that rarely affect visitors', dot: 'bg-muted-foreground' },
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

const times = (n: number) => `${n.toLocaleString()} time${n === 1 ? '' : 's'}`;

/** One line saying what an error is doing in the period, in plain words. */
export function errorLine(g: ErrorGroup, periodStart: number, periodLabel: string): string {
  const w = g.window;
  if (HARMLESS.test(g.message)) {
    return `Browser warning — usually harmless${w ? ` · ${times(w.count)} ${periodLabel}` : ''}`;
  }
  if (!w) return g.last_page_path ? `On ${g.last_page_path}` : '';
  const isNew = new Date(g.first_seen).getTime() >= periodStart;
  const where = w.pages.length ? ` on ${w.pages.slice(0, 2).join(' and ')}` : '';
  const who = w.sessions > 0 ? `, ${w.sessions.toLocaleString()} visitor${w.sessions === 1 ? '' : 's'} affected` : '';
  const trend = isNew
    ? 'New'
    : w.prev_count === 0 && w.count > 0
      ? 'Back again'
      : w.count >= 2 * w.prev_count && w.count >= 10
        ? `Up from ${w.prev_count.toLocaleString()}`
        : w.count * 2 <= w.prev_count
          ? `Down from ${w.prev_count.toLocaleString()}`
          : 'Steady';
  if (w.count === 0) return `Not seen ${periodLabel}`;
  return `${trend} · ${times(w.count)}${where} ${periodLabel}${who}`;
}

/** The list's groups: each error under exactly one, the most pressing it is in. */
export type ErrorBucket = ErrorGroupId | 'steady';
export const ERROR_BUCKETS: Array<{ id: ErrorBucket; label: string; dot: string }> = [
  ...ERROR_GROUP_META.filter((g) => g.id !== 'better' && g.id !== 'noisy'),
  { id: 'steady', label: 'Steady', dot: 'bg-muted-foreground/70' },
  ...ERROR_GROUP_META.filter((g) => g.id === 'better' || g.id === 'noisy'),
];

export function errorBucket(g: ErrorGroup, periodStart: number): ErrorBucket {
  // Harmless first: a browser warning that is "new" is still not worth a look.
  if (inErrorGroup(g, 'noisy', periodStart)) return 'noisy';
  const order: ErrorGroupId[] = ['new', 'worse', 'key_pages', 'better'];
  return order.find((id) => inErrorGroup(g, id, periodStart)) ?? 'steady';
}
