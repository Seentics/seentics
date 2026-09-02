'use client';

import { useMemo } from 'react';
import { Globe, Sparkles, SlidersHorizontal, Sun } from 'lucide-react';
import { SummaryCards } from '@/components/analytics/SummaryCards';
import { TrafficOverview } from '@/components/analytics/TrafficOverview';
import { TopPagesChart } from '@/components/analytics/TopPagesChart';
import { TopSourcesChart } from '@/components/analytics/TopSourcesChart';
import { ChartErrorBoundary } from '@/components/analytics/ChartErrorBoundary';
import { Card, CardContent } from '@/components/ui/card';
import { demoAnalyticsData } from '@/lib/demo';
import { MockSidebar } from './MockSidebar';

/**
 * The analytics overview, whole: sidebar, page chrome, and the real charts.
 *
 * The charts are the app's own components fed the demo dataset — not redrawn — which
 * is the only way the shot stays true as the dashboard changes. The header row and
 * page padding mirror `app/websites/[websiteId]/page.tsx`; the controls are inert
 * copies of the real ones (website switcher, Ask Seentics AI, filters, theme).
 */
/** How far the dashboard is zoomed out inside the lid. See the note in the render. */
const INNER_SCALE = 0.86;

export function DashboardMock() {
  const demoData = useMemo(() => demoAnalyticsData(), []);

  const topPages = useMemo(
    () => ({
      top_pages:
        demoData.topPages?.top_pages?.map((page: any) => ({
          page: page.page || '/',
          views: page.views || 0,
          unique_visitors: page.unique || 0,
          avg_time_on_page: page.avg_time || 0,
          bounce_rate: page.bounce_rate || 0,
        })) ?? [],
    }),
    [demoData],
  );

  const topReferrers = useMemo(
    () => ({
      top_referrers:
        demoData.topReferrers?.top_referrers?.map((ref: any) => ({
          referrer: ref.referrer || 'Direct',
          visitors: ref.unique || 0,
          page_views: ref.views || 0,
          avg_session_duration: 0,
        })) ?? [],
    }),
    [demoData],
  );

  return (
    /*
     * The dashboard is laid out wider than the screen and scaled down, so more of the
     * page fits in the same 16:10 lid.
     *
     * At 1:1 the shot stopped just as Top Pages and Traffic Sources came into view,
     * which made the dashboard look like it ended at the traffic chart. `INNER_SCALE`
     * buys about 190px more vertical page — enough for both cards to be half visible,
     * which reads as a page that continues rather than one that stops.
     *
     * The width compensation is what keeps it filling the frame: laying out at
     * `100 / INNER_SCALE` percent and then scaling by `INNER_SCALE` lands back on the
     * frame's own width.
     */
    <div
      className="flex bg-background text-foreground"
      style={{
        transform: `scale(${INNER_SCALE})`,
        transformOrigin: 'top left',
        width: `${100 / INNER_SCALE}%`,
        height: `${100 / INNER_SCALE}%`,
      }}
    >
      <MockSidebar active="Overview" />

      <main className="min-w-0 flex-1 overflow-hidden bg-background">
        {/*
          Capped, but wider than the real page's 1200.

          Laying out at 1/INNER_SCALE makes this column ~1400px, so leaving it
          uncapped stretched the cards and charts far wider than the dashboard ever
          is. A 1200 cap fixed that but centred the content and left a visible gutter
          against the sidebar. 1290 is the compromise: the stretch is gone and the
          leftover margin is small enough not to read as a gap.
        */}
        <div className="mx-auto w-full max-w-[1290px] space-y-6 p-8">
          {/* Header — the real page's single compact control row */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-8 w-[180px] items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm dark:border-none">
              <Globe className="h-3 w-3 shrink-0 text-primary" />
              <span className="truncate font-medium text-foreground">Acme Store</span>
            </div>

            <div className="flex-1" />

            <div className="flex h-8 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 text-xs font-medium text-indigo-600 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-400">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span>Ask Seentics AI</span>
              <kbd className="rounded-lg border border-indigo-200 bg-white px-1.5 py-px font-mono text-[10px] dark:border-indigo-500/30 dark:bg-indigo-500/10">
                ⌘K
              </kbd>
            </div>

            <div className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-foreground dark:border-none">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Last 7 days</span>
            </div>

            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card dark:border-none">
              <Sun className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          <SummaryCards
            websiteId=""
            isDemo
            isLoading={false}
            data={demoData.dashboardData}
            dailyStats={demoData.dailyStats}
            visitorInsights={demoData.visitorInsights}
          />

          <ChartErrorBoundary label="Traffic Overview">
            <TrafficOverview
              dailyStats={demoData.dailyStats}
              hourlyStats={demoData.hourlyStats}
              isLoading={false}
              showComparison={false}
            />
          </ChartErrorBoundary>

          {/* Pages & Sources — runs off the bottom of the screen, so the shot reads
              as a page that keeps going rather than one that happens to end. */}
          <div className="grid grid-cols-2 gap-5">
            <Card className="border border-border bg-card">
              <CardContent className="p-5">
                <ChartErrorBoundary label="Top Pages">
                  <TopPagesChart
                    data={topPages}
                    entryPages={demoData.visitorInsights?.visitor_insights?.top_entry_pages}
                    exitPages={demoData.visitorInsights?.visitor_insights?.top_exit_pages}
                    isLoading={false}
                  />
                </ChartErrorBoundary>
              </CardContent>
            </Card>

            <Card className="border border-border bg-card">
              <CardContent className="p-5">
                <ChartErrorBoundary label="Top Sources">
                  <TopSourcesChart data={topReferrers} isLoading={false} />
                </ChartErrorBoundary>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
