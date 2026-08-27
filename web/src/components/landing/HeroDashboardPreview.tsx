'use client';

import { Globe, Download, Settings, Sun } from 'lucide-react';
import { useMemo } from 'react';
import { SummaryCards } from '@/components/analytics/SummaryCards';
import { TrafficOverview } from '@/components/analytics/TrafficOverview';
import { TopPagesChart } from '@/components/analytics/TopPagesChart';
import { TopSourcesChart } from '@/components/analytics/TopSourcesChart';
import { GeolocationOverview } from '@/components/analytics/GeolocationOverview';
import { TopDevicesChart } from '@/components/analytics/TopDevicesChart';
import { UTMPerformanceChart } from '@/components/analytics/UTMPerformanceChart';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartErrorBoundary } from '@/components/analytics/ChartErrorBoundary';
import { demoAnalyticsData } from '@/lib/demo';
import { Logo } from '@/components/ui/logo';

/* How far the dashboard is zoomed out inside the hero frame. The frame is 740px
   tall on desktop, so this is what decides how much of the page is on screen:
   at 0.5 roughly 1480px of dashboard fits, which carries past Pages & Sources,
   through the map, and into the Devices/UTM row under the bottom fade. */
const PREVIEW_SCALE = 0.8;

/* Mirrors the demo branch of `transformedTopResolutions` on the real analytics
   page, which inlines these rather than reading them off the demo dataset. */
const DEMO_RESOLUTIONS = [
  { name: '1920x1080', count: 450, percentage: 45.0 },
  { name: '1366x768', count: 320, percentage: 32.0 },
  { name: '375x812', count: 280, percentage: 28.0 },
  { name: '1440x900', count: 210, percentage: 21.0 },
  { name: '414x896', count: 150, percentage: 15.0 },
];

export default function HeroDashboardPreview() {
  const demoData = useMemo(() => demoAnalyticsData(), []);

  const transformedTopPages = useMemo(() => ({
    top_pages: demoData.topPages?.top_pages?.map((page: any) => ({
      page: page.page || '/',
      views: page.views || 0,
      unique_visitors: page.unique || 0,
      avg_time_on_page: page.avg_time || 0,
      bounce_rate: page.bounce_rate || 0,
    })) ?? [],
  }), [demoData]);

  const transformedTopReferrers = useMemo(() => ({
    top_referrers: demoData.topReferrers?.top_referrers?.map((ref: any) => ({
      referrer: ref.referrer || 'Direct',
      visitors: ref.unique || 0,
      page_views: ref.views || 0,
      avg_session_duration: 0,
    })) ?? [],
  }), [demoData]);

  const transformedTopDevices = useMemo(() => ({
    top_devices: demoData.topDevices?.top_devices?.map((device: any) => ({
      device: device.device || 'Unknown',
      visitors: device.unique || 0,
      page_views: device.views || 0,
      avg_session_duration: 0,
    })) ?? [],
  }), [demoData]);

  const transformedTopOS = useMemo(() => ({
    top_os: demoData.topOS?.top_os?.map((os: any) => ({
      os: os.os || 'Unknown',
      visitors: os.unique || 0,
      page_views: os.views || 0,
      avg_session_duration: 0,
    })) ?? [],
  }), [demoData]);

  const transformedTopBrowsers = useMemo(() => ({
    top_browsers: demoData.topBrowsers?.top_browsers?.map((browser: any) => ({
      browser: browser.browser || 'Unknown',
      visitors: browser.unique || 0,
      views: browser.views || 0,
      market_share: 0,
      version: 'Unknown',
    })) ?? [],
  }), [demoData]);

  return (
    // h-full, not a fixed max-height: the frame around this is the real clip, and
    // anchoring here lets the bottom fade land on the frame's edge instead of
    // hundreds of pixels below it, where it was never visible.
    <div className="overflow-hidden relative text-left h-full">
      <div
        className="pointer-events-none select-none"
        style={{
          transform: `scale(${PREVIEW_SCALE})`,
          transformOrigin: 'top center',
          width: `${100 / PREVIEW_SCALE}%`,
          marginLeft: `${-(100 / PREVIEW_SCALE - 100) / 2}%`,
        }}
      >
        {/* Dashboard Header */}
        <div className="flex items-center gap-2 px-4 md:px-8 py-2 flex-wrap">
          <Logo size="sm" showText className="hidden sm:flex" />
          <Logo size="sm" className="sm:hidden" />
          <div className="w-px h-5 bg-border/60 mx-1" />
          <div className="flex items-center gap-1.5 h-8 px-3 bg-card/50 rounded-lg border border-border/40 text-xs">
            <Globe className="h-3 w-3 text-primary shrink-0" />
            <span className="font-medium text-foreground">Demo Site</span>
          </div>
          <div className="flex-1" />
          <div className="h-8 px-2.5 flex items-center gap-1.5 bg-card/50 rounded-lg border border-border/40 text-[11px] font-medium text-muted-foreground">
            Last 7 days
          </div>
          <div className="h-8 px-2.5 flex items-center gap-1.5 bg-card/50 rounded-lg border border-border/40 text-[11px] font-medium text-muted-foreground">
            <Download className="h-3 w-3" />
            <span className="hidden sm:inline">Export</span>
          </div>
          <div className="h-8 w-8 flex items-center justify-center bg-card/50 rounded-lg border border-border/40">
            <Settings className="h-3 w-3 text-muted-foreground" />
          </div>
          <div className="h-8 w-8 flex items-center justify-center bg-card/50 rounded-lg border border-border/40">
            <Sun className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </div>

        {/* Dashboard Content */}
        <div className="px-4 md:px-8 pb-8 space-y-6">
          <SummaryCards
            websiteId=""
            isDemo={true}
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

          {/* AUDIENCE INTELLIGENCE — mirrors the real page's section order and
              card chrome (`border-none`), so the mock reads as the product. */}
          <div className="space-y-4">
            {/* Pages & Sources */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Card className="border border-border bg-card">
                <CardContent className="p-5">
                  <ChartErrorBoundary label="Top Pages">
                    <TopPagesChart
                      data={transformedTopPages}
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
                    <TopSourcesChart data={transformedTopReferrers} isLoading={false} />
                  </ChartErrorBoundary>
                </CardContent>
              </Card>
            </div>

            {/* Geolocation Map — full width. Sits under the bottom fade, so it
                reads as a page that keeps going rather than one that stops. */}
            <ChartErrorBoundary label="Geographic Intelligence">
              <GeolocationOverview data={demoData.geolocationData} isLoading={false} />
            </ChartErrorBoundary>

            {/* Devices + UTM — 2-col grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Card className="border border-border bg-card">
                <CardContent className="p-5">
                  <ChartErrorBoundary label="Top Devices">
                    <TopDevicesChart
                      data={transformedTopDevices}
                      osData={transformedTopOS}
                      screenData={{ top_resolutions: DEMO_RESOLUTIONS }}
                      browserData={transformedTopBrowsers}
                      isLoading={false}
                    />
                  </ChartErrorBoundary>
                </CardContent>
              </Card>

              <Card className="border border-border bg-card overflow-hidden">
                <CardHeader className="p-5 pb-3 border-b border-border/60">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="min-w-0 shrink-0">
                      <h3 className="text-base font-semibold tracking-tight whitespace-nowrap">UTM breakdown</h3>
                      <p className="text-xs text-muted-foreground mt-0.5 whitespace-nowrap">Sources, mediums &amp; campaigns</p>
                    </div>
                    {/* Static in the preview — the whole mock is pointer-events-none. */}
                    <Tabs value="sources" className="w-full md:w-auto shrink-0">
                      <TabsList className="grid w-full grid-cols-3 h-8 bg-muted/50 p-0.5 rounded-lg">
                        <TabsTrigger value="sources" className="h-7 text-xs font-medium rounded-lg data-[state=inactive]:text-muted-foreground data-[state=inactive]:bg-transparent data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">Sources</TabsTrigger>
                        <TabsTrigger value="mediums" className="h-7 text-xs font-medium rounded-lg data-[state=inactive]:text-muted-foreground data-[state=inactive]:bg-transparent data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">Mediums</TabsTrigger>
                        <TabsTrigger value="campaigns" className="h-7 text-xs font-medium rounded-lg data-[state=inactive]:text-muted-foreground data-[state=inactive]:bg-transparent data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">Campaigns</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <ChartErrorBoundary label="UTM breakdown">
                    <UTMPerformanceChart
                      data={demoData.customEvents?.utm_performance as any}
                      isLoading={false}
                      hideTabs={true}
                      controlledTab="sources"
                    />
                  </ChartErrorBoundary>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-background via-background/80 to-transparent z-10" />
    </div>
  );
}
