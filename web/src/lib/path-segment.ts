'use client';

import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react';

/**
 * Reads a path segment directly from the browser's URL instead of the App
 * Router's resolved `params`/`useParams()`.
 *
 * Confirmed against Next's own source (create-initial-router-state.js,
 * app-router.js): `usePathname()`'s value comes from `canonicalUrl`, which
 * is seeded from `location.href` — but `useParams()` comes from
 * `getSelectedParams(tree)`, where `tree` is the statically-baked segment
 * tree from whatever shell file was served. On the SPA-shell redirects in
 * public/_redirects, that tree matches the placeholder param the shell was
 * built for, not the real URL, until an actual client-side navigation
 * re-resolves it. `window.location` sidesteps that distinction entirely —
 * it's always the real URL, hydrated or not.
 *
 * `null` on the very first render (static markup has no `window`), then the
 * real value once mounted — every caller already has a loading state for
 * the data fetch this feeds, so the one-tick gap is free.
 */
/**
 * A path to read instead of the browser's, for a page rendered somewhere it does not live:
 * the landing page's dashboard preview shows the real demo pages (`/websites/demo/...`)
 * inside its window.
 */
const PathOverride = createContext<string | null>(null);

export function PathOverrideProvider({ path, children }: { path: string; children: ReactNode }) {
  return createElement(PathOverride.Provider, { value: path }, children);
}

export function usePathSegment(indexFromStart: number): string | null {
  const override = useContext(PathOverride);
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    if (override !== null) return;
    const segments = window.location.pathname.split('/').filter(Boolean);
    setValue(segments[indexFromStart] ?? null);
  }, [indexFromStart, override]);

  if (override !== null) return override.split('/').filter(Boolean)[indexFromStart] ?? null;
  return value;
}
