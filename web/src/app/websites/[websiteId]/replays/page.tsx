'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { DataTable, SortableHeader, ColumnDef } from '@/components/ui/data-table';
import { StatCards } from '@/components/seentics-ui/StatCards';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Video, Clock, Monitor, Smartphone, Tablet,
  AlertTriangle, Search, Users, RefreshCw,
} from 'lucide-react';
import { isDemo } from '@/lib/demo';
import { demoReplays } from '@/lib/demo/replays';
import { listSessions, type ReplaySession } from '@/lib/replays-api';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function DeviceIcon({ device }: { device: string }) {
  const d = device.toLowerCase();
  if (d === 'mobile') return <Smartphone className="h-3.5 w-3.5" />;
  if (d === 'tablet') return <Tablet className="h-3.5 w-3.5" />;
  return <Monitor className="h-3.5 w-3.5" />;
}

// Unified row type
interface SessionRow {
  id:            string;
  session_id:    string;
  country:       string;
  browser:       string;
  os:            string;
  device:        string;
  entry_page:    string;
  duration_seconds: number;
  pages_viewed:  number;
  has_errors:    boolean;
  has_rage_clicks: boolean;
  start_time:    string;
}

export default function ReplaysPage() {
  const params     = useParams();
  const router     = useRouter();
  const websiteId  = params?.websiteId as string;
  const isDemoMode = isDemo(websiteId);

  const [search,       setSearch]       = useState('');
  const [deviceFilter, setDeviceFilter] = useState('all');

  // Real API
  const { data: apiData, isLoading, refetch } = useQuery({
    queryKey:  ['sessions', websiteId],
    queryFn:   () => listSessions(websiteId, 100, 0),
    enabled:   !isDemoMode,
    staleTime: 30_000,
  });

  // Normalise to common row shape
  const allSessions: SessionRow[] = useMemo(() => {
    if (isDemoMode) {
      return demoReplays().sessions.map(s => ({
        id:               s.id,
        session_id:       s.session_id,
        country:          s.country,
        browser:          s.browser,
        os:               s.os,
        device:           s.device,
        entry_page:       s.entry_page,
        duration_seconds: s.duration_seconds,
        pages_viewed:     s.pages_viewed,
        has_errors:       s.has_errors,
        has_rage_clicks:  s.has_rage_clicks,
        start_time:       s.start_time,
      }));
    }
    return (apiData?.sessions ?? []).map((s: ReplaySession) => ({
      id:               s.sessionId,
      session_id:       s.sessionId,
      country:          s.country   || 'Unknown',
      browser:          s.browser   || 'Unknown',
      os:               s.os        || 'Unknown',
      device:           s.device    || 'Desktop',
      entry_page:       s.entryPage || '/',
      duration_seconds: 0,
      pages_viewed:     0,
      has_errors:       false,
      has_rage_clicks:  s.hasRageClicks,
      start_time:       s.startedAt,
    }));
  }, [isDemoMode, apiData]);

  const filtered = useMemo(() =>
    allSessions.filter(s => {
      if (deviceFilter !== 'all' && s.device.toLowerCase() !== deviceFilter) return false;
      if (search && ![s.country, s.browser, s.entry_page].some(v =>
        v.toLowerCase().includes(search.toLowerCase()))) return false;
      return true;
    }),
    [allSessions, deviceFilter, search],
  );

  const withErrors  = allSessions.filter(s => s.has_errors).length;
  const withRage    = allSessions.filter(s => s.has_rage_clicks).length;
  const avgDuration = allSessions.length && allSessions.some(s => s.duration_seconds > 0)
    ? Math.round(allSessions.reduce((s, r) => s + r.duration_seconds, 0) / allSessions.length)
    : 0;

  const columns: ColumnDef<SessionRow>[] = [
    {
      id: 'session',
      header: ({ column }) => <SortableHeader column={column}>Session</SortableHeader>,
      accessorFn: row => row.country,
      cell: ({ row }) => {
        const s = row.original;
        return (
          <div className="flex items-center gap-2 min-w-0">
            <DeviceIcon device={s.device} />
            <span className="text-sm font-medium text-foreground">{s.country}</span>
            <span className="text-xs text-muted-foreground">{s.browser}</span>
            <span className="text-xs text-muted-foreground hidden md:inline">· {s.os}</span>
          </div>
        );
      },
    },
    {
      id: 'entry_page',
      header: 'Entry Page',
      accessorKey: 'entry_page',
      cell: ({ getValue }) => (
        <span className="font-mono text-xs text-muted-foreground">{getValue() as string}</span>
      ),
    },
    {
      id: 'pages_viewed',
      header: ({ column }) => <SortableHeader column={column}>Pages</SortableHeader>,
      accessorKey: 'pages_viewed',
      size: 70,
      cell: ({ getValue }) => {
        const v = getValue() as number;
        return <span className="text-xs text-center block">{v > 0 ? v : '—'}</span>;
      },
    },
    {
      id: 'duration',
      header: ({ column }) => <SortableHeader column={column}>Duration</SortableHeader>,
      accessorKey: 'duration_seconds',
      size: 100,
      cell: ({ getValue }) => {
        const v = getValue() as number;
        return v > 0 ? (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3 shrink-0" />
            {formatDuration(v)}
          </div>
        ) : <span className="text-xs text-muted-foreground">—</span>;
      },
    },
    {
      id: 'flags',
      header: 'Flags',
      size: 100,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {row.original.has_rage_clicks && (
            <Badge className="text-[10px] px-1.5 py-0 h-4 bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 border">
              rage
            </Badge>
          )}
          {row.original.has_errors && (
            <Badge className="text-[10px] px-1.5 py-0 h-4 bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 border">
              error
            </Badge>
          )}
        </div>
      ),
    },
    {
      id: 'when',
      header: 'When',
      accessorKey: 'start_time',
      size: 90,
      cell: ({ getValue }) => (
        <span className="text-xs text-muted-foreground">{timeAgo(getValue() as string)}</span>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1200px] mx-auto">
      <DashboardPageHeader
        title="Session Replays"
        description="Watch real user sessions to understand exactly how people use your product."
        icon={Video}
      >
        {!isDemoMode && (
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        )}
      </DashboardPageHeader>

      <StatCards cards={[
        { label: 'Total Sessions', value: allSessions.length, icon: Users },
        { label: 'Avg Duration',   value: avgDuration > 0 ? formatDuration(avgDuration) : '—', icon: Clock, iconColor: 'text-blue-600', valueColor: 'text-blue-600' },
        { label: 'With Errors',    value: withErrors, icon: AlertTriangle, iconColor: 'text-red-500', valueColor: withErrors > 0 ? 'text-red-500' : undefined },
        { label: 'Rage Clicks',    value: withRage,   icon: AlertTriangle, iconColor: 'text-orange-500', valueColor: withRage > 0 ? 'text-orange-500' : undefined },
      ]} />

      <DataTable
        data={filtered}
        columns={columns}
        isLoading={isLoading}
        toolbarLeft={
          <div>
            <h3 className="text-sm font-semibold text-foreground">Recorded Sessions</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {filtered.length} session{filtered.length !== 1 ? 's' : ''} recorded
            </p>
          </div>
        }
        toolbarRight={
          <>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by country, browser, page..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs w-56"
              />
            </div>
            <Select value={deviceFilter} onValueChange={setDeviceFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all"     className="text-xs">All devices</SelectItem>
                <SelectItem value="desktop" className="text-xs">Desktop</SelectItem>
                <SelectItem value="mobile"  className="text-xs">Mobile</SelectItem>
                <SelectItem value="tablet"  className="text-xs">Tablet</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
        onRowClick={row => router.push(`/websites/${websiteId}/replays/${row.session_id}`)}
        emptyIcon={<Video className="h-6 w-6" />}
        emptyTitle="No sessions yet"
        emptyDescription={isDemoMode
          ? 'No sessions match your filters.'
          : 'Install the Seentics tracker with recording enabled to capture sessions.'}
        pageSize={15}
      />
    </div>
  );
}
