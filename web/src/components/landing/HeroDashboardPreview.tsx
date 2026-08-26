'use client';

import { Globe, Download, Settings, Sun, Users } from 'lucide-react';
import { useMemo } from 'react';
import { SummaryCards } from '@/components/analytics/SummaryCards';
import { TrafficOverview } from '@/components/analytics/TrafficOverview';
import { TopPagesChart } from '@/components/analytics/TopPagesChart';
import { TopSourcesChart } from '@/components/analytics/TopSourcesChart';
import { Card, CardContent } from '@/components/ui/card';
import { ChartErrorBoundary } from '@/components/analytics/ChartErrorBoundary';
import { demoAnalyticsData } from '@/lib/demo';
import { Logo } from '@/components/ui/logo';

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

  return (
    <div className="overflow-hidden relative text-left" style={{ maxHeight: '820px' }}>
      <div
        className="pointer-events-none select-none"
        style={{
          transform: 'scale(0.85)',
          transformOrigin: 'top center',
          width: `${100 / 0.85}%`,
          marginLeft: `${-(100 / 0.85 - 100) / 2}%`,
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

          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <Users className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold tracking-tight">Audience Intelligence</h2>
              <div className="h-px bg-border flex-1 ml-3" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Card className="border border-border/60 bg-card shadow-sm">
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

              <Card className="border border-border/60 bg-card shadow-sm">
                <CardContent className="p-5">
                  <ChartErrorBoundary label="Top Sources">
                    <TopSourcesChart data={transformedTopReferrers} isLoading={false} />
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
