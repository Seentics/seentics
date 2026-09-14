'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Whether a website opens in AI mode instead of the dashboard.
 *
 * Per website and per browser, because it is a working preference rather than an account
 * setting: the same person may want AI mode on a site they are investigating and the
 * dashboard on one they are reporting from, and neither choice belongs to the account.
 *
 * A previous attempt stored `seentics-default-mode` as a single global key with nothing
 * reading it, so the toggle wrote a preference that never took effect. This one is read
 * by `useDefaultModeRedirect`, which is the half that was missing.
 */
const KEY_PREFIX = 'seentics:default-mode:';

export type DashboardMode = 'ai' | 'dashboard';

function storageKey(websiteId: string): string {
  return `${KEY_PREFIX}${websiteId}`;
}

/** Reads the stored preference. `dashboard` unless AI mode was chosen. */
export function readDefaultMode(websiteId: string): DashboardMode {
  if (typeof window === 'undefined' || !websiteId) return 'dashboard';
  try {
    return localStorage.getItem(storageKey(websiteId)) === 'ai' ? 'ai' : 'dashboard';
  } catch {
    // Private browsing, or storage disabled. The dashboard is the safe answer.
    return 'dashboard';
  }
}

export function writeDefaultMode(websiteId: string, mode: DashboardMode): void {
  if (typeof window === 'undefined' || !websiteId) return;
  try {
    if (mode === 'ai') localStorage.setItem(storageKey(websiteId), 'ai');
    else localStorage.removeItem(storageKey(websiteId));
  } catch {
    /* Not being able to remember the preference is not worth an error. */
  }
}

/**
 * The toggle's state.
 *
 * Read in an effect rather than during render: `localStorage` does not exist on the
 * server, and seeding state from it directly makes the first client render disagree with
 * the markup Next sent, which React reports as a hydration mismatch.
 */
export function useDefaultMode(websiteId: string) {
  const [mode, setMode] = useState<DashboardMode>('dashboard');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setMode(readDefaultMode(websiteId));
    setReady(true);
  }, [websiteId]);

  const toggle = useCallback(() => {
    setMode((prev) => {
      const next: DashboardMode = prev === 'ai' ? 'dashboard' : 'ai';
      writeDefaultMode(websiteId, next);
      return next;
    });
  }, [websiteId]);

  return { mode, isDefaultAi: mode === 'ai', ready, toggle };
}

/**
 * Sends the visitor to AI mode when this website is set to open there.
 *
 * Called from the dashboard overview, which is the route someone lands on. `replace`
 * rather than `push` so Back returns to wherever they came from instead of bouncing them
 * straight back into the redirect.
 *
 * Deliberately a client-side redirect: the preference lives in `localStorage`, which the
 * server cannot read, so a middleware redirect would need the preference in a cookie —
 * and a cookie sent on every request to record a UI preference is the wrong trade.
 *
 * `skip` exists so arriving *from* AI mode does not bounce back. Switching to the
 * dashboard has to be possible while AI mode is still the default.
 */
export function useDefaultModeRedirect(
  websiteId: string,
  replace: (href: string) => void,
  skip = false,
): void {
  useEffect(() => {
    if (skip || !websiteId) return;
    if (readDefaultMode(websiteId) !== 'ai') return;
    replace(`/websites/${websiteId}/ai`);
    // `replace` is stable from Next's router; listing it would re-run this on every
    // render of a page that re-creates its handlers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [websiteId, skip]);
}
