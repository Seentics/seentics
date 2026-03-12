'use client';

import { useParams } from 'next/navigation';
import { useRealtimeData } from '@/lib/analytics-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Activity, Globe, Monitor, Chrome, ExternalLink, Eye, Users, Layers } from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { useMemo } from 'react';

// ─── 30-Minute Activity Timeline ────────────────────────────────────────────
function RealtimeTimeline({ timeline }: { timeline: Array<{ minute: string; visitors: number; views: number }> }) {
  const max = useMemo(() => Math.max(...timeline.map(t => t.views), 1), [timeline]);

  if (timeline.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
        Waiting for activity data...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-[3px] h-28">
        {timeline.map((t, i) => {
          const height = Math.max((t.views / max) * 100, 4);
          const isRecent = i >= timeline.length - 5;
          return (
            <div key={t.minute} className="flex-1 flex flex-col items-center group relative">
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                <div className="bg-popover text-popover-foreground text-[10px] font-medium px-2 py-1 rounded-md shadow-lg border whitespace-nowrap">
                  {t.minute} &middot; {t.views} views &middot; {t.visitors} visitors
                </div>
              </div>
              <div
                className={cn(
                  "w-full rounded-sm transition-all duration-300",
                  isRecent
                    ? "bg-primary/80 hover:bg-primary"
                    : "bg-primary/30 hover:bg-primary/50"
                )}
                style={{ height: `${height}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground/60 px-0.5">
        <span>{timeline[0]?.minute}</span>
        <span>30 min ago</span>
        <span>{timeline[timeline.length - 1]?.minute}</span>
      </div>
    </div>
  );
}

// ─── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon: Icon,
  color,
  isLoading,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  isLoading: boolean;
}) {
  return (
    <Card className="border border-border/60 bg-card shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className={cn("p-2.5 rounded-xl", color)}>
            <Icon size={18} className="opacity-80" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className={cn("text-2xl font-bold tabular-nums tracking-tight", isLoading && "animate-pulse")}>
              {isLoading ? '--' : value.toLocaleString()}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Breakdown List ─────────────────────────────────────────────────────────
function BreakdownCard({
  title,
  icon: Icon,
  items,
  emptyText,
  isLoading,
  renderLabel,
}: {
  title: string;
  icon: React.ElementType;
  items: Array<{ name: string; visitors: number }>;
  emptyText: string;
  isLoading: boolean;
  renderLabel?: (name: string) => React.ReactNode;
}) {
  const total = useMemo(() => items.reduce((sum, i) => sum + i.visitors, 0), [items]);

  return (
    <Card className="border border-border/60 bg-card shadow-sm">
      <CardHeader className="p-6 pb-4 border-b border-border/60">
        <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2">
          <Icon size={15} className="text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-7 bg-muted/30 rounded animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">{emptyText}</p>
        ) : (
          <div className="space-y-2.5">
            {items.map((item) => {
              const pct = total > 0 ? (item.visitors / total) * 100 : 0;
              return (
                <div key={item.name} className="group">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-foreground truncate font-medium max-w-[65%]">
                      {renderLabel ? renderLabel(item.name) : (item.name || '(unknown)')}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground tabular-nums">{pct.toFixed(0)}%</span>
                      <span className="text-sm font-semibold text-foreground tabular-nums w-8 text-right">{item.visitors}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/60 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Active Pages Table ─────────────────────────────────────────────────────
function ActivePagesTable({
  pages,
  isLoading,
}: {
  pages: Array<{ page: string; visitors: number }>;
  isLoading: boolean;
}) {
  const max = pages.length > 0 ? pages[0].visitors : 1;

  return (
    <Card className="border border-border/60 bg-card shadow-sm">
      <CardHeader className="p-6 pb-4 border-b border-border/60">
        <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2">
          <Layers size={15} className="text-muted-foreground" />
          Active Pages
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-9 bg-muted/30 rounded animate-pulse" />
            ))}
          </div>
        ) : pages.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">No active pages right now</p>
        ) : (
          <div>
            {/* Table header */}
            <div className="grid grid-cols-12 gap-2 px-6 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 border-b border-border/40">
              <div className="col-span-8">Page</div>
              <div className="col-span-4 text-right">Visitors</div>
            </div>
            {/* Table rows */}
            <div className="divide-y divide-border/30">
              {pages.map((p, i) => {
                const barWidth = Math.max((p.visitors / max) * 100, 3);
                return (
                  <div
                    key={p.page}
                    className="grid grid-cols-12 gap-2 px-6 py-3 items-center group hover:bg-muted/20 transition-colors relative"
                  >
                    <div
                      className="absolute inset-y-0 left-0 bg-primary/[0.04] transition-all duration-300"
                      style={{ width: `${barWidth}%` }}
                    />
                    <div className="col-span-8 relative z-10">
                      <span className="text-sm font-medium text-foreground truncate block">
                        {p.page}
                      </span>
                    </div>
                    <div className="col-span-4 text-right relative z-10">
                      <span className="text-sm font-bold tabular-nums text-foreground">{p.visitors}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function RealtimePage() {
  const { websiteId } = useParams<{ websiteId: string }>();
  const { data, isLoading } = useRealtimeData(websiteId);

  return (
    <div className="p-6 md:p-8 lg:p-10 w-full max-w-[1400px] mx-auto">
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

          {/* Header */}
          <DashboardPageHeader
            title="Realtime"
            description="Live visitor activity on your website right now."
          >
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Live</span>
            </div>
          </DashboardPageHeader>

          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Active Visitors"
              value={data?.active_visitors ?? 0}
              icon={Users}
              color="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              isLoading={isLoading}
            />
            <StatCard
              label="Pageviews"
              value={data?.pageviews ?? 0}
              icon={Eye}
              color="bg-blue-500/10 text-blue-600 dark:text-blue-400"
              isLoading={isLoading}
            />
            <StatCard
              label="Sessions"
              value={data?.sessions ?? 0}
              icon={Activity}
              color="bg-violet-500/10 text-violet-600 dark:text-violet-400"
              isLoading={isLoading}
            />
            <StatCard
              label="Pages / Visitor"
              value={data?.active_visitors ? Math.round((data.pageviews / data.active_visitors) * 10) / 10 : 0}
              icon={Layers}
              color="bg-amber-500/10 text-amber-600 dark:text-amber-400"
              isLoading={isLoading}
            />
          </div>

          {/* Activity Timeline */}
          <Card className="border border-border/60 bg-card shadow-sm">
            <CardHeader className="p-6 pb-4 border-b border-border/60">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2">
                  <Activity size={15} className="text-muted-foreground" />
                  Activity (last 30 minutes)
                </CardTitle>
                <span className="text-[11px] text-muted-foreground/60">per minute</span>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {isLoading ? (
                <div className="h-28 bg-muted/20 rounded animate-pulse" />
              ) : (
                <RealtimeTimeline timeline={data?.timeline ?? []} />
              )}
            </CardContent>
          </Card>

          {/* Active Pages */}
          <ActivePagesTable pages={data?.top_pages ?? []} isLoading={isLoading} />

          {/* Breakdown Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <BreakdownCard
              title="Top Referrers"
              icon={ExternalLink}
              items={data?.top_referrers ?? []}
              emptyText="No referrer data"
              isLoading={isLoading}
            />
            <BreakdownCard
              title="Countries"
              icon={Globe}
              items={data?.top_countries ?? []}
              emptyText="No country data"
              isLoading={isLoading}
            />
            <BreakdownCard
              title="Devices"
              icon={Monitor}
              items={data?.top_devices ?? []}
              emptyText="No device data"
              isLoading={isLoading}
            />
            <BreakdownCard
              title="Browsers"
              icon={Chrome}
              items={data?.top_browsers ?? []}
              emptyText="No browser data"
              isLoading={isLoading}
            />
          </div>

        </div>
    </div>
  );
}
