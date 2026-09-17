'use client';

import { useEffect, useState } from 'react';

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
export function usePathSegment(indexFromStart: number): string | null {
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    const segments = window.location.pathname.split('/').filter(Boolean);
    setValue(segments[indexFromStart] ?? null);
  }, [indexFromStart]);

  return value;
}
