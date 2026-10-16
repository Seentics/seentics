/**
 * Which dashboard pages a person keeps in their sidebar.
 *
 * Not every account uses every page, so each one can be hidden from the sidebar. Hidden pages
 * still work — a bookmark opens them, and the page you are on always shows — they are just not
 * listed. Kept per person in this browser: the account's server-side preferences are not stored
 * yet (core's preferences routes are stubs).
 */
import { useCallback, useSyncExternalStore } from 'react';

/** The sidebar's pages, by a stable id. Overview and Settings cannot be hidden. */
export const NAV_IDS = [
  'overview', 'recording', 'heatmaps', 'funnels', 'automations', 'leads', 'revenue',
  'conversions', 'ai-reports', 'errors', 'developers', 'settings',
] as const;
export type NavId = (typeof NAV_IDS)[number];

export const LOCKED: ReadonlySet<NavId> = new Set<NavId>(['overview', 'settings']);

const KEY_PREFIX = 'seentics-sidebar-hidden';
const EVENT = 'seentics-sidebar-hidden-change';

export const storageKey = (userId: string | null | undefined) => `${KEY_PREFIX}:${userId || 'anon'}`;

/** The stored list, cleaned: known, hideable ids only, each once. */
export function parseHidden(raw: string | null): NavId[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    const known = new Set<string>(NAV_IDS);
    return [...new Set(list.filter((v): v is NavId => typeof v === 'string' && known.has(v) && !LOCKED.has(v as NavId)))];
  } catch {
    return [];
  }
}

/** The items to list: everything not hidden, plus the page you are on even when it is. */
export function visibleItems<T extends { id: NavId }>(items: readonly T[], hidden: readonly NavId[], activeId: NavId | null): T[] {
  const off = new Set(hidden);
  return items.filter((item) => !off.has(item.id) || item.id === activeId);
}

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function subscribe(onChange: () => void) {
  // Another tab (storage) or another sidebar on this page — the panel and the phone drawer.
  window.addEventListener('storage', onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

/** This person's hidden pages, and a setter; the same in every sidebar and tab. */
export function useHiddenNav(userId: string | null | undefined): [NavId[], (next: NavId[]) => void] {
  const key = storageKey(userId);
  // The raw string is the snapshot: stable between renders, so React does not loop.
  const raw = useSyncExternalStore(subscribe, () => read(key), () => null);
  const set = useCallback((next: NavId[]) => {
    try {
      const clean = next.filter((id) => !LOCKED.has(id));
      if (clean.length) localStorage.setItem(key, JSON.stringify([...new Set(clean)]));
      else localStorage.removeItem(key);
    } catch { /* storage blocked (private mode): nothing to save to */ }
    window.dispatchEvent(new Event(EVENT));
  }, [key]);
  return [parseHidden(raw), set];
}
