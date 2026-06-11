'use client';

import { useRealtimeData, useRecentActivity, type RealtimeMinute } from '@/lib/analytics-api';
import { RecentActivityFeed } from '@/components/analytics/RecentActivityFeed';
import { RealtimeGeoMap } from '@/components/analytics/RealtimeGeoMap';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { StatCards } from '@/components/seentics-ui/StatCards';
import { Button } from '@/components/ui/button';
import { isDemo } from '@/lib/demo';
import { cn } from '@/lib/utils';
import { Eye, Layers, Radio, RefreshCw, Users } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

function RealtimeTimelineChart({ timeline, isLoading }: { timeline?: RealtimeMinute[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="border border-border/50 bg-card/50 shadow-sm rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border/50">
          <div className="h-4 w-36 bg-muted/50 animate-pulse rounded" />
        </div>
        <div className="p-4 md:p-5 h-40 bg-muted/20 animate-pulse" />
      </div>
    );
  }
  const data = timeline ?? [];
  const hasData = data.some(d => d.views > 0 || d.visitors > 0);
  return (
    <div className="border border-border/50 bg-card/50 shadow-sm rounded-xl overflow-hidden">
      <div className="px-4 py-3 md:px-5 md:py-3.5 border-b border-border/50 flex items-center justify-between">
        <div>
          <h3 className="text-base font-medium tracking-tight text-foreground">Last 30 minutes</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Pageviews and unique visitors per minute.</p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5 rounded bg-blue-500" />Pageviews</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5 rounded bg-emerald-500" />Visitors</span>
        </div>
      </div>
      <div className="p-4 md:p-5 h-40">
        {!hasData ? (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
            No traffic in the last 30 minutes
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="rtViews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="rtVisitors" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="minute" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={4} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))' }}
                formatter={(val: number, name: string) => [val, name === 'views' ? 'Pageviews' : 'Visitors']}
                labelStyle={{ fontSize: 10, color: 'hsl(var(--muted-foreground))' }}
              />
              <Area type="monotone" dataKey="views" stroke="#2563eb" strokeWidth={1.5} fill="url(#rtViews)" dot={false} />
              <Area type="monotone" dataKey="visitors" stroke="#10b981" strokeWidth={1.5} fill="url(#rtVisitors)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function TopList({ title, rows, isLoading }: {
  title: string;
  rows?: Array<{ name?: string; page?: string; visitors: number }>;
  isLoading: boolean;
}) {
  const items = rows ?? [];
  const max = items[0]?.visitors ?? 1;
  return (
    <div className="border border-border/50 bg-card/50 shadow-sm rounded-xl overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-border/50">
        <h3 className="text-sm font-medium tracking-tight text-foreground">{title}</h3>
      </div>
      <div className="p-3 flex-1 space-y-1">
        {isLoading ? (
          [...Array(5)].map((_, i) => <div key={i} className="h-5 bg-muted/40 animate-pulse rounded" />)
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">No data yet</p>
        ) : (
          items.slice(0, 8).map((r, i) => {
            const label = r.page ?? r.name ?? '—';
            const pct = Math.round((r.visitors / max) * 100);
            return (
              <div key={i} className="relative flex items-center justify-between gap-2 px-2 py-1 rounded text-xs">
                <div className="absolute inset-0 rounded bg-primary/5" style={{ width: `${pct}%` }} />
                <span className="relative truncate font-mono text-foreground" title={label}>{label}</span>
                <span className="relative shrink-0 tabular-nums text-muted-foreground">{r.visitors}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/** `/websites/[id]/realtime` — matches Replays / Heatmaps shell, header, and stat tiles. */
export function RealtimeDashboardSection({ websiteId }: { websiteId: string }) {
  const isDemoMode = isDemo(websiteId);
  const {
    data,
    isLoading: statsLoading,
    isFetching: statsFetching,
    refetch: refetchStats,
  } = useRealtimeData(websiteId);
  const {
    data: recentActivityData,
    isLoading: recentLoading,
    isFetching: recentFetching,
    refetch: refetchActivity,
  } = useRecentActivity(websiteId, {
    limit: 50,
    withinMinutes: 30,
    refetchIntervalMs: 12_000,
    staleTimeMs: 8000,
  });

  const pageviewsN = Number(data?.pageviews ?? 0);
  const activeN = Number(data?.active_visitors ?? 0);
  const pps = activeN > 0 ? (pageviewsN / activeN).toFixed(1) : '0.0';
  const refreshing = statsFetching || recentFetching;

  return (
    <div className="w-full max-w-[1440px] mx-auto p-4 md:p-6 lg:p-8">
      <DashboardPageHeader
        title="Realtime"
        description="Live traffic in the last ~30 minutes and a running log of recent pageviews with visitor context."
      >
        {!isDemoMode && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            disabled={refreshing}
            onClick={() => {
              void refetchStats();
              void refetchActivity();
            }}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Refresh
          </Button>
        )}
      </DashboardPageHeader>

      <StatCards
        isLoading={statsLoading}
        cards={
          statsLoading
            ? []
            : [
                {
                  label: 'Active now',
                  value: data?.active_visitors ?? 0,
                  icon: Radio,
                  iconColor: 'text-primary',
                  valueColor: 'text-primary',
                },
                { label: 'Pageviews', value: data?.pageviews ?? 0, icon: Eye },
                { label: 'Sessions', value: data?.sessions ?? 0, icon: Users },
                {
                  label: 'Pages / visitor',
                  value: pps,
                  icon: Layers,
                  iconColor: 'text-muted-foreground',
                },
              ]
        }
      />

      <RealtimeTimelineChart timeline={data?.timeline} isLoading={statsLoading} />

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
        <TopList title="Top pages" rows={data?.top_pages} isLoading={statsLoading} />
        <TopList title="Top countries" rows={data?.top_countries} isLoading={statsLoading} />
      </div>

      <div className="mt-6 border border-border/50 bg-card/50 shadow-sm rounded-xl overflow-hidden">
        <div className="px-4 py-3 md:px-5 md:py-3.5 border-b border-border/50">
          <h3 className="text-base font-medium tracking-tight text-foreground">Activity log</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Page URL, country, device, OS, browser, source, and time. Updates about every 12 seconds.
          </p>
        </div>
        <div className="p-4 md:p-5">
          <RecentActivityFeed
            embed
            rowLayout="table"
            websiteId={websiteId}
            data={recentActivityData}
            isLoading={recentLoading}
            tableScrollClassName="border-0 rounded-none shadow-none bg-transparent max-h-[min(32rem,60vh)]"
          />
        </div>
      </div>

      <div className="mt-6">
        <RealtimeGeoMap data={recentActivityData} isLoading={recentLoading} />
      </div>
    </div>
  );
}
