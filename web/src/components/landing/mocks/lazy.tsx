'use client';

import dynamic from 'next/dynamic';

/**
 * The mock bodies, deferred.
 *
 * `DashboardMock` reuses the real `TrafficOverview`, which imports `TrafficChart`
 * and `HourlyTrafficChart`, which import recharts — so the marketing page was
 * pulling a charting library into the bundle that decides its LCP. The other four
 * are hand-built and carry no library, but they are large DOM trees sitting below
 * the fold, so they are deferred too.
 *
 * Only the *contents* of each laptop are lazy; `MacbookFrame` stays eager. The frame
 * holds the space with an `aspect-ratio` box, so nothing shifts when a mock arrives
 * — the fallback just needs to fill the screen area, not reserve it.
 *
 * `ssr: false` because none of this is content: every mock is `aria-hidden`
 * decoration, so there is nothing for a crawler to read and no reason to spend
 * server render time or HTML bytes on it. (`next/dynamic` with `ssr: false` has to
 * live in a Client Component, which is what this file is for — `ProductShowcase` is
 * a Server Component.)
 */

/** Placeholder while a mock loads. Plain surface — no spinner on a decorative shot. */
const loading = () => <div className="h-full w-full bg-background" />;

export const LazyDashboardMock = dynamic(
  () => import('./DashboardMock').then((m) => m.DashboardMock),
  { ssr: false, loading },
);

export const LazyAutomationBuilderMock = dynamic(
  () => import('./AutomationBuilderMock').then((m) => m.AutomationBuilderMock),
  { ssr: false, loading },
);

export const LazyFunnelMock = dynamic(
  () => import('./FunnelMock').then((m) => m.FunnelMock),
  { ssr: false, loading },
);

export const LazyReplayMock = dynamic(
  () => import('./ReplayMock').then((m) => m.ReplayMock),
  { ssr: false, loading },
);

export const LazyHeatmapMock = dynamic(
  () => import('./HeatmapMock').then((m) => m.HeatmapMock),
  { ssr: false, loading },
);
