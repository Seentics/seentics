'use client';

import { useParams } from 'next/navigation';
import { useRealtimeData } from '@/lib/analytics-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Activity, Globe, Monitor, Chrome, ExternalLink, Eye } from 'lucide-react';

function RealtimeBar({ label, value, max }: { label: string; value: number; max: number }) {
  const width = max > 0 ? Math.max((value / max) * 100, 2) : 0;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-foreground truncate">{label || '(unknown)'}</span>
          <span className="text-sm font-medium text-foreground tabular-nums ml-2">{value}</span>
        </div>
        <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${width}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function RealtimeSection({
  title,
  icon: Icon,
  items,
  emptyText,
}: {
  title: string;
  icon: React.ElementType;
  items: Array<{ name: string; visitors: number }>;
  emptyText: string;
}) {
  const max = items.length > 0 ? items[0].visitors : 0;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Icon size={15} className="text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">{emptyText}</p>
        ) : (
          <div className="space-y-0.5">
            {items.map((item, i) => (
              <RealtimeBar key={i} label={item.name} value={item.visitors} max={max} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function RealtimePage() {
  const { websiteId } = useParams<{ websiteId: string }>();
  const { data, isLoading } = useRealtimeData(websiteId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Realtime</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live visitor activity in the last 5 minutes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
          </span>
          <span className="text-xs text-muted-foreground">Updating every 5s</span>
        </div>
      </div>

      {/* Big number cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-primary/10">
                <Activity size={20} className="text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Active Visitors</p>
                <p className={cn(
                  "text-3xl font-bold tabular-nums transition-all",
                  isLoading && "animate-pulse"
                )}>
                  {isLoading ? '--' : (data?.active_visitors ?? 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-500/10">
                <Eye size={20} className="text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Pageviews (5 min)</p>
                <p className={cn(
                  "text-3xl font-bold tabular-nums transition-all",
                  isLoading && "animate-pulse"
                )}>
                  {isLoading ? '--' : (data?.pageviews ?? 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active pages */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ExternalLink size={15} className="text-muted-foreground" />
            Active Pages
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-8 bg-muted/30 rounded animate-pulse" />
              ))}
            </div>
          ) : (data?.active_pages?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No active pages right now</p>
          ) : (
            <div className="space-y-0.5">
              {data!.active_pages.map((p, i) => (
                <RealtimeBar key={i} label={p.page} value={p.visitors} max={data!.active_pages[0].visitors} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Breakdown grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RealtimeSection
          title="Top Referrers"
          icon={ExternalLink}
          items={data?.top_referrers ?? []}
          emptyText="No referrers tracked yet"
        />
        <RealtimeSection
          title="Countries"
          icon={Globe}
          items={data?.top_countries ?? []}
          emptyText="No country data yet"
        />
        <RealtimeSection
          title="Devices"
          icon={Monitor}
          items={data?.top_devices ?? []}
          emptyText="No device data yet"
        />
        <RealtimeSection
          title="Browsers"
          icon={Chrome}
          items={data?.top_browsers ?? []}
          emptyText="No browser data yet"
        />
      </div>
    </div>
  );
}
