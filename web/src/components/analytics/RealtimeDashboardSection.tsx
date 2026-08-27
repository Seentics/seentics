'use client';

import { useRealtimeData, useRecentActivity, type RealtimeMinute } from '@/lib/analytics-api';
import { RecentActivityFeed } from '@/components/analytics/RecentActivityFeed';
import { RealtimeGeoMap } from '@/components/analytics/RealtimeGeoMap';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { StatCards } from '@/components/seentics-ui/StatCards';
import { Button } from '@/components/ui/button';
import { isDemo } from '@/lib/demo';
import { cn } from '@/lib/utils';
import { Eye, Layers, Radio, RefreshCw, Users, Globe, Home, BarChart3, Zap, Workflow, DollarSign, Shield, CreditCard, Users2, Package, FileText, Info, Phone, LogIn, Settings, ShoppingCart } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

function getPathFromUrl(url: string) {
  if (!url) return '/';
  try { return new URL(url).pathname; } catch { return url.split('?')[0]; }
}

function getPageIcon(page: string) {
  if (!page) return <Globe className="w-3.5 h-3.5 text-muted-foreground" />;
  const path = getPathFromUrl(page).toLowerCase();
  if (path === '/') return <Home className="w-3.5 h-3.5 text-indigo-500" />;
  if (path.includes('/heatmaps')) return <Zap className="w-3.5 h-3.5 text-orange-500" />;
  if (path.includes('/replays')) return <Workflow className="w-3.5 h-3.5 text-purple-500" />;
  if (path.includes('/realtime')) return <BarChart3 className="w-3.5 h-3.5 text-green-500" />;
  if (path.includes('/funnels')) return <Workflow className="w-3.5 h-3.5 text-indigo-500" />;
  if (path.includes('/revenue')) return <DollarSign className="w-3.5 h-3.5 text-green-600" />;
  if (path.includes('/dashboard')) return <BarChart3 className="w-3.5 h-3.5 text-indigo-500" />;
  if (path.includes('/admin')) return <Shield className="w-3.5 h-3.5 text-red-500" />;
  if (path.includes('/websites')) return <Globe className="w-3.5 h-3.5 text-indigo-500" />;
  if (path.includes('/billing') || path.includes('/subscriptions')) return <CreditCard className="w-3.5 h-3.5 text-indigo-500" />;
  if (path.includes('/team') || path.includes('/users')) return <Users2 className="w-3.5 h-3.5 text-blue-500" />;
  if (path.includes('/storage')) return <Package className="w-3.5 h-3.5 text-gray-500" />;
  if (path.includes('/blog') || path.includes('/post')) return <FileText className="w-3.5 h-3.5 text-green-500" />;
  if (path.includes('/about')) return <Info className="w-3.5 h-3.5 text-indigo-500" />;
  if (path.includes('/contact')) return <Phone className="w-3.5 h-3.5 text-orange-500" />;
  if (path.includes('/pricing')) return <DollarSign className="w-3.5 h-3.5 text-yellow-500" />;
  if (path.includes('/analytics')) return <BarChart3 className="w-3.5 h-3.5 text-indigo-500" />;
  if (path.includes('/auth') || path.includes('/login')) return <LogIn className="w-3.5 h-3.5 text-gray-500" />;
  if (path.includes('/settings')) return <Settings className="w-3.5 h-3.5 text-gray-600" />;
  if (path.includes('/cart')) return <ShoppingCart className="w-3.5 h-3.5 text-indigo-600" />;
  return <Globe className="w-3.5 h-3.5 text-indigo-500" />;
}

function getPageLabel(page: string) {
  const path = getPathFromUrl(page);
  if (path === '/') return 'Homepage';
  const segs = path.split('/').filter(Boolean);
  if (!segs.length) return path;
  const last = segs[segs.length - 1];
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(last)) {
    return segs[0] === 'websites' ? 'Website dashboard' : 'Detail page';
  }
  return last.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function countryFlag(code: string) {
  if (!code || code.length !== 2) return '🌐';
  return code.toUpperCase().replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

function RealtimeTimelineChart({ timeline, isLoading }: { timeline?: RealtimeMinute[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="surface overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <div className="h-4 w-36 bg-muted/50 animate-pulse rounded-lg" />
        </div>
        <div className="p-4 md:p-5 h-40 bg-muted/20 animate-pulse" />
      </div>
    );
  }
  const data = timeline ?? [];
  const hasData = data.some(d => d.views > 0 || d.visitors > 0);
  return (
    <div className="surface overflow-hidden">
      <div className="px-4 py-3 md:px-5 md:py-3.5 border-b border-border flex items-center justify-between">
        <div>
          <h3 className=" font-semibold text-foreground">Last 30 minutes</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Pageviews and unique visitors per minute.</p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5 rounded-lg bg-blue-500" />Pageviews</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5 rounded-lg bg-emerald-500" />Visitors</span>
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

function TopList({ title, rows, isLoading, type = 'pages' }: {
  title: string;
  rows?: Array<{ name?: string; page?: string; visitors: number }>;
  isLoading: boolean;
  type?: 'pages' | 'countries';
}) {
  const items = rows ?? [];
  const max = items[0]?.visitors ?? 1;
  return (
    <div className="surface overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-medium tracking-tight text-foreground">{title}</h3>
      </div>
      <div className="p-3 flex-1 space-y-1">
        {isLoading ? (
          [...Array(5)].map((_, i) => <div key={i} className="h-5 bg-muted/40 animate-pulse rounded-lg" />)
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">No data yet</p>
        ) : (
          items.slice(0, 8).map((r, i) => {
            const pct = Math.round((r.visitors / max) * 100);
            if (type === 'countries') {
              const code = r.name ?? '';
              const flag = countryFlag(code);
              return (
                <div key={i} className="relative flex items-center justify-between gap-2 px-2 py-1 rounded-lg text-xs">
                  <div className="absolute inset-0 rounded-lg bg-primary/5" style={{ width: `${pct}%` }} />
                  <span className="relative flex items-center gap-1.5 truncate text-foreground">
                    <span className="text-sm leading-none">{flag}</span>
                    <span className="truncate">{code || '—'}</span>
                  </span>
                  <span className="relative shrink-0 tabular-nums text-muted-foreground">{r.visitors}</span>
                </div>
              );
            }
            const page = r.page ?? r.name ?? '';
            const label = getPageLabel(page);
            const icon = getPageIcon(page);
            return (
              <div key={i} className="relative flex items-center justify-between gap-2 px-2 py-1 rounded-lg text-xs">
                <div className="absolute inset-0 rounded-lg bg-primary/5" style={{ width: `${pct}%` }} />
                <span className="relative flex items-center gap-1.5 truncate text-foreground" title={page}>
                  {icon}
                  <span className="truncate">{label}</span>
                </span>
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
    refetchIntervalMs: 15_000,
    staleTimeMs: 12_000,
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
            variant="default"
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
                  tone: 'success' as const,
                },
                { label: 'Pageviews', value: data?.pageviews ?? 0, icon: Eye, tone: 'info' as const },
                { label: 'Sessions', value: data?.sessions ?? 0, icon: Users, tone: 'accent' as const },
                {
                  label: 'Pages / visitor',
                  value: pps,
                  icon: Layers,
                  tone: 'warning' as const,
                },
              ]
        }
      />

      <RealtimeTimelineChart timeline={data?.timeline} isLoading={statsLoading} />

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
        <TopList title="Top pages" rows={data?.top_pages} isLoading={statsLoading} type="pages" />
        <TopList title="Top countries" rows={data?.top_countries} isLoading={statsLoading} type="countries" />
      </div>

      <div className="mt-6  rounded-lg overflow-hidden bg-card">
        <div className="px-4 py-3 md:px-5 md:py-3.5 border-b border-border">
          <h3 className="text-base font-medium tracking-tight text-foreground">Activity log</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Page URL, country, device, OS, browser, source, and time. Updates about every 12 seconds.
          </p>
        </div>
        <div className="p-4 md:p-5 bg-card">
          <RecentActivityFeed
            embed
            rowLayout="table"
            websiteId={websiteId}
            data={recentActivityData}
            isLoading={recentLoading}
            tableScrollClassName="border-0 bg-card rounded-lg-none shadow-none  max-h-[min(32rem,60vh)]"
          />
        </div>
      </div>

      <div className="mt-6">
        <RealtimeGeoMap data={recentActivityData} isLoading={recentLoading} />
      </div>
    </div>
  );
}
