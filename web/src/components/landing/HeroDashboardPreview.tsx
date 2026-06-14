'use client';

import {
  LayoutDashboard, Activity, GitBranch,
  Video, Flame, Bot, Settings, Banknote,
  Globe, Download, Sun, Users,
} from 'lucide-react';
import { useMemo } from 'react';
import { SummaryCards } from '@/components/analytics/SummaryCards';
import { TrafficOverview } from '@/components/analytics/TrafficOverview';
import { TopPagesChart } from '@/components/analytics/TopPagesChart';
import { TopSourcesChart } from '@/components/analytics/TopSourcesChart';
import { Card, CardContent } from '@/components/ui/card';
import { ChartErrorBoundary } from '@/components/analytics/ChartErrorBoundary';
import { demoAnalyticsData } from '@/lib/demo';
import { Logo } from '@/components/ui/logo';
import { cn } from '@/lib/utils';

const NAV = [
  { icon: LayoutDashboard, label: 'Overview', active: true },
  { icon: Activity,        label: 'Realtime' },
  { icon: Video,           label: 'Recording' },
  { icon: Flame,           label: 'Heatmaps' },
  { icon: GitBranch,       label: 'Funnels' },
  { icon: Banknote,        label: 'Revenue' },
  { icon: Bot,             label: 'Automations' },
  { icon: Settings,        label: 'Settings' },
];

function MockSidebar() {
  return (
    <aside className="flex flex-col h-full w-[248px] shrink-0 bg-card border-r border-border/60">
      {/* Logo */}
      <div className="flex h-[60px] items-center gap-2 px-4 border-b border-border/40">
        <Logo size="sm" className="shrink-0" />
        <span className="text-[16px] font-bold tracking-tight text-primary">Seentics</span>
      </div>

      {/* Website pill */}
      <div className="px-3 pt-3 pb-1">
        <div className="flex items-center gap-2 h-9 px-3 rounded-md bg-muted/40 border border-border/40 text-xs">
          <Globe className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="font-medium text-foreground truncate">Demo Site</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2">
        <ul className="space-y-0.5">
          {NAV.map((item) => (
            <li key={item.label}>
              <div className={cn(
                'flex items-center gap-3 h-10 px-3 rounded-md',
                item.active
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground/50',
              )}>
                <item.icon className="h-[17px] w-[17px] shrink-0" />
                <span className="text-[13.5px] font-medium">{item.label}</span>
              </div>
            </li>
          ))}
        </ul>
      </nav>

      {/* Avatar */}
      <div className="px-3 pb-5">
        <div className="flex items-center gap-3 h-10 px-3 rounded-md bg-muted/30 border border-border/40">
          <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">D</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">Demo User</p>
            <p className="text-[10px] text-muted-foreground truncate">demo@seentics.com</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

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
    <div className="overflow-hidden relative rounded-xl border border-border/60 shadow-2xl text-left" style={{ maxHeight: '820px' }}>
      <div
        className="pointer-events-none select-none flex"
        style={{
          transform: 'scale(0.55)',
          transformOrigin: 'top left',
          width: `${100 / 0.55}%`,
          height: `${100 / 0.55}%`,
        }}
      >
        {/* Sidebar */}
        <MockSidebar />

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
          {/* Top bar */}
          <div className="flex items-center gap-2 px-6 py-3 border-b border-border/40 h-[60px] shrink-0">
            <span className="text-sm font-semibold text-foreground">Overview</span>
            <div className="flex-1" />
            <div className="h-8 px-2.5 flex items-center gap-1.5 bg-card rounded-md border border-border/40 text-[11px] font-medium text-muted-foreground">
              Last 7 days
            </div>
            <div className="h-8 px-2.5 flex items-center gap-1.5 bg-card rounded-md border border-border/40 text-[11px] font-medium text-muted-foreground">
              <Download className="h-3 w-3" />
              Export
            </div>
            <div className="h-8 w-8 flex items-center justify-center bg-card rounded-md border border-border/40">
              <Sun className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </div>

          {/* Dashboard content */}
          <div className="flex-1 overflow-hidden px-6 pb-8 pt-6 space-y-6">
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
              <div className="grid grid-cols-2 gap-5">
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
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-background via-background/80 to-transparent z-10" />
    </div>
  );
}
