'use client';

import { createContext, useContext, useMemo } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Where a page's links go.
 *
 * The recordings and heatmaps pages move between a list and a detail view with
 * `router.push('/websites/<id>/…')`. Inside an embed there is no such route — the iframe stays
 * on `/embed/<id>` — so the embed provides its own `push`, which switches the view in place.
 * Everywhere else the default below is the ordinary Next router, so the pages behave as before.
 */
export type AppNavigation = { push: (href: string) => void; replace: (href: string) => void };

const EmbedNavContext = createContext<AppNavigation | null>(null);

export const EmbedNavProvider = EmbedNavContext.Provider;

export function useAppNavigation(): AppNavigation {
  const embedded = useContext(EmbedNavContext);
  const router = useRouter();
  return useMemo(
    () => embedded ?? { push: (href: string) => router.push(href), replace: (href: string) => router.replace(href) },
    [embedded, router],
  );
}
