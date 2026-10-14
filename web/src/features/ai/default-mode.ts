'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAiStatus } from './queries';

/**
 * Whether a website opens in AI mode or on the dashboard.
 *
 * Per website and per browser, because it is a working preference rather than an account
 * setting: the same person may want AI mode on a site they are investigating and the
 * dashboard on one they are reporting from, and neither choice belongs to the account.
 *
 * AI mode is the default when AI is configured on this deployment and the visitor has not
 * chosen. Choosing either way is stored explicitly (`'ai'` or `'dashboard'`), so a visitor
 * who picked the dashboard keeps it. An absent key — including the one an earlier version
 * left behind when "dashboard" was stored by removing the key — means "not chosen".
 */
const KEY_PREFIX = 'seentics:default-mode:';

export type DashboardMode = 'ai' | 'dashboard';
/** What was stored: an explicit choice, or `null` for "not chosen". */
export type StoredMode = DashboardMode | null;

function storageKey(websiteId: string): string {
  return `${KEY_PREFIX}${websiteId}`;
}

/** The explicit choice for this website, or `null` when there is none (or no storage). */
export function readStoredMode(websiteId: string): StoredMode {
  if (typeof window === 'undefined' || !websiteId) return null;
  try {
    const value = localStorage.getItem(storageKey(websiteId));
    return value === 'ai' || value === 'dashboard' ? value : null;
  } catch {
    // Private browsing, or storage disabled. Treated as "not chosen".
    return null;
  }
}

export function writeDefaultMode(websiteId: string, mode: DashboardMode): void {
  if (typeof window === 'undefined' || !websiteId) return;
  try {
    localStorage.setItem(storageKey(websiteId), mode);
  } catch {
    /* Not being able to remember the preference is not worth an error. */
  }
}

/**
 * The mode a website opens in, from the stored choice and whether AI is configured.
 *
 * `configured` is `undefined` while that is still being asked. An explicit choice never
 * waits on it; "not chosen" does, because the answer depends on it.
 */
export function resolveDefaultMode(
  stored: StoredMode,
  configured: boolean | undefined,
): DashboardMode | 'pending' {
  if (stored) return stored;
  if (configured === undefined) return 'pending';
  return configured ? 'ai' : 'dashboard';
}

/** What a toggle flips to: always an explicit choice, the opposite of what is in effect. */
export function nextExplicitMode(effective: DashboardMode): DashboardMode {
  return effective === 'ai' ? 'dashboard' : 'ai';
}

/** `undefined` until storage has been read — on the server and the first client render. */
function useStoredMode(websiteId: string) {
  const [stored, setStored] = useState<StoredMode | undefined>(undefined);
  useEffect(() => {
    setStored(websiteId ? readStoredMode(websiteId) : undefined);
  }, [websiteId]);
  return [stored, setStored] as const;
}

/**
 * The toggle's state.
 *
 * Read in an effect rather than during render: `localStorage` does not exist on the
 * server, and seeding state from it directly makes the first client render disagree with
 * the markup Next sent, which React reports as a hydration mismatch.
 */
export function useDefaultMode(websiteId: string) {
  const [stored, setStored] = useStoredMode(websiteId);
  const status = useAiStatus(stored === null);
  const resolved = stored === undefined
    ? 'pending'
    : resolveDefaultMode(stored, status.isPending ? undefined : status.data?.configured);
  const mode: DashboardMode = resolved === 'ai' ? 'ai' : 'dashboard';

  const toggle = useCallback(() => {
    const next = nextExplicitMode(mode);
    writeDefaultMode(websiteId, next);
    setStored(next);
  }, [mode, websiteId, setStored]);

  return { mode, isDefaultAi: mode === 'ai', ready: resolved !== 'pending', toggle };
}

/**
 * Sends the visitor to AI mode when this website opens there.
 *
 * Called from the dashboard overview, which is the route someone lands on. `replace`
 * rather than `push` so Back returns to wherever they came from instead of bouncing them
 * straight back into the redirect.
 *
 * Deliberately a client-side redirect: the preference lives in `localStorage`, which the
 * server cannot read, so a middleware redirect would need the preference in a cookie —
 * and a cookie sent on every request to record a UI preference is the wrong trade.
 *
 * `skip` exists so arriving *from* AI mode (`?dashboard=1`), an embed, or the demo never
 * redirects. Returns `pending` while the answer is not known — or the redirect is under
 * way — so the caller can hold the dashboard back instead of flashing it.
 */
export function useDefaultModeRedirect(
  websiteId: string,
  replace: (href: string) => void,
  skip = false,
): { pending: boolean } {
  // The demo is checked by id here rather than through `@/lib/demo`, which would pull every
  // demo fixture into whatever imports this.
  const neverRedirect = skip || websiteId === 'demo';
  const [stored] = useStoredMode(neverRedirect ? '' : websiteId);
  const status = useAiStatus(!neverRedirect && stored === null);

  const resolved: DashboardMode | 'pending' = neverRedirect
    ? 'dashboard'
    : !websiteId || stored === undefined
      ? 'pending'
      : resolveDefaultMode(stored, status.isPending ? undefined : status.data?.configured);

  useEffect(() => {
    if (resolved !== 'ai' || !websiteId) return;
    replace(`/websites/${websiteId}/ai`);
    // `replace` is stable from Next's router; listing it would re-run this on every
    // render of a page that re-creates its handlers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved, websiteId]);

  return { pending: resolved !== 'dashboard' };
}
