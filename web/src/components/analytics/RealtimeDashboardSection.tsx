'use client';

import { useRealtimeData, useRecentActivity } from '@/lib/analytics-api';
import { RecentActivityFeed } from '@/components/analytics/RecentActivityFeed';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { StatCards } from '@/components/seentics-ui/StatCards';
import { Button } from '@/components/ui/button';
import { isDemo } from '@/lib/demo';
import { cn } from '@/lib/utils';
import { Eye, Layers, Radio, RefreshCw, Users } from 'lucide-react';

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

      <div className="border border-border/50 bg-card/50 shadow-sm rounded-xl overflow-hidden">
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
    </div>
  );
}
