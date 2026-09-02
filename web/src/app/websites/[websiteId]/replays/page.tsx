'use client';

import { useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { DataTable, SortableHeader, ColumnDef, selectionColumn } from '@/components/ui/data-table';
import { StatCards } from '@/components/seentics-ui/StatCards';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Video,
  Clock,
  AlertTriangle,
  Search,
  Users,
  RefreshCw,
  Trash2,
  Play,
  MousePointerClick,
} from 'lucide-react';
import { isDemo } from '@/lib/demo';
import { demoReplays } from '@/lib/demo/replays';
import { listSessions, deleteSessions, type ReplaySession } from '@/lib/replays-api';
import { useToast } from '@/hooks/use-toast';
import { SessionClientRowStack, SessionCountryVisual } from '@/components/replays/session-environment-visuals';


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

/** Strip origin; keep path (+ query). Truncate for table cells; tooltip shows full path. */
const ENTRY_PATH_MAX = 56;

/** Drop redundant `/websites/{id}/` when entry URLs are recorded as dashboard routes. */
function stripWebsiteDashboardPrefix(path: string, websiteId: string): string {
  if (!websiteId) return path;
  const prefix = `/websites/${websiteId}`;
  if (path === prefix || path === `${prefix}/`) return '/';
  if (path.startsWith(`${prefix}/`)) return path.slice(prefix.length);
  return path;
}

function entryPathDisplay(raw: string, websiteId: string): { display: string; title: string } {
  const t = raw?.trim() || '/';
  let path = t;
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t) || t.startsWith('//')) {
      const u = new URL(t.startsWith('//') ? `https:${t}` : t);
      path = `${u.pathname}${u.search}` || '/';
    }
  } catch {
    /* treat as plain path */
  }
  if (!path.startsWith('/')) path = `/${path}`;

  const title = path;
  const relative = stripWebsiteDashboardPrefix(path, websiteId);
  const display =
    relative.length <= ENTRY_PATH_MAX
      ? relative
      : `${relative.slice(0, ENTRY_PATH_MAX - 1)}…`;
  return { display, title };
}

// Unified row type
interface SessionRow {
  id: string;
  session_id: string;
  country: string;
  browser: string;
  os: string;
  device: string;
  entry_page: string;
  duration_seconds: number;
  pages_viewed: number;
  has_errors: boolean;
  has_rage_clicks: boolean;
  start_time: string;
}

export default function ReplaysPage() {
  const params = useParams();
  const router = useRouter();
  const websiteId = params?.websiteId as string;
  const isDemoMode = isDemo(websiteId);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [deviceFilter, setDeviceFilter] = useState('all');

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => {
      if (isDemoMode) return Promise.resolve();
      return deleteSessions(websiteId, ids);
    },
    onSuccess: () => {
      if (!isDemoMode) {
        queryClient.invalidateQueries({ queryKey: ['sessions', websiteId] });
      }
      toast({
        title: isDemoMode ? "Action simulated" : "Sessions deleted",
        description: isDemoMode
          ? "In demo mode, sessions are not actually deleted."
          : "The selected sessions have been successfully removed.",
      });
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "Deletion failed",
        description: err.message || "Something went wrong while deleting sessions.",
      });
    },
  });



  // Real API
  const { data: apiData, isLoading, refetch } = useQuery({
    queryKey: ['sessions', websiteId],
    queryFn: () => listSessions(websiteId, 100, 0),
    enabled: !isDemoMode,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  // Normalise to common row shape
  const allSessions: SessionRow[] = useMemo(() => {
    if (isDemoMode) {
      return demoReplays().sessions.map(s => ({
        id: s.id,
        session_id: s.session_id,
        country: s.country,
        browser: s.browser,
        os: s.os,
        device: s.device,
        entry_page: s.entry_page,
        duration_seconds: s.duration_seconds,
        pages_viewed: s.pages_viewed,
        has_errors: s.has_errors,
        has_rage_clicks: s.has_rage_clicks,
        start_time: s.start_time,
      }));
    }
    return (apiData?.sessions ?? []).map((s: ReplaySession) => ({
      id: s.sessionId,
      session_id: s.sessionId,
      country: s.country || 'Unknown',
      browser: s.browser || 'Unknown',
      os: s.os || 'Unknown',
      device: s.device || 'Desktop',
      entry_page: s.entryPage || '/',
      duration_seconds: s.durationSeconds || 0,
      pages_viewed: s.pagesViewed || 0,
      has_errors: Boolean(s.hasErrors),
      has_rage_clicks: s.hasRageClicks,
      start_time: s.startedAt,
    }));

  }, [isDemoMode, apiData]);

  const filtered = useMemo(() =>
    allSessions.filter(s => {
      if (deviceFilter !== 'all' && s.device.toLowerCase() !== deviceFilter) return false;
      if (
        search &&
        ![s.country, s.browser, s.os, s.device, s.entry_page, s.session_id].some(v =>
          v.toLowerCase().includes(search.toLowerCase()),
        )
      ) {
        return false;
      }
      return true;
    }),
    [allSessions, deviceFilter, search],
  );

  const withErrors = allSessions.filter(s => s.has_errors).length;
  const withRage = allSessions.filter(s => s.has_rage_clicks).length;
  const avgDuration = allSessions.length && allSessions.some(s => s.duration_seconds > 0)
    ? Math.round(allSessions.reduce((s, r) => s + r.duration_seconds, 0) / allSessions.length)
    : 0;

  const columns = useMemo<ColumnDef<SessionRow>[]>(() => [
    selectionColumn<SessionRow>(),
    {
      id: 'country',
      accessorKey: 'country',
      header: ({ column }) => <SortableHeader column={column}>Location</SortableHeader>,
      size: 140,
      cell: ({ row }) => <SessionCountryVisual country={row.original.country} compact />,
    },
    {
      id: 'client',
      header: 'Client',
      accessorFn: row => `${row.browser}|${row.os}|${row.device}`,
      size: 200,
      cell: ({ row }) => {
        const s = row.original;
        return <SessionClientRowStack browser={s.browser} os={s.os} device={s.device} />;
      },
    },
    {
      id: 'entry_page',
      header: 'Entry page',
      accessorKey: 'entry_page',
      size: 220,
      cell: ({ getValue }) => {
        const { display, title } = entryPathDisplay(getValue() as string, websiteId);
        return (
          <span
            className="inline-flex max-w-full min-w-0 items-center rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 font-mono text-[11px] leading-snug text-foreground sm:text-xs"
            title={title}
          >
            <span className="truncate">{display}</span>
          </span>
        );
      },
    },
    {
      id: 'duration',
      header: ({ column }) => <SortableHeader column={column}>Duration</SortableHeader>,
      accessorKey: 'duration_seconds',
      size: 118,
      cell: ({ row }) => {
        const v = row.original.duration_seconds;
        return (
          <div>
            <span className="text-sm font-semibold tabular-nums tracking-tight text-foreground">
              {v > 0 ? formatDuration(v) : '—'}
            </span>
            {/* `pages_viewed` was already on the row type and simply never rendered.
                It is what separates a one-page bounce from a real journey of the
                same length. */}
            <p className="text-[11px] text-muted-foreground">
              {row.original.pages_viewed} {row.original.pages_viewed === 1 ? 'page' : 'pages'}
            </p>
          </div>
        );
      },
    },
    {
      id: 'signals',
      header: 'Signals',
      accessorFn: row => (row.has_errors ? 2 : 0) + (row.has_rage_clicks ? 1 : 0),
      size: 132,
      cell: ({ row }) => {
        const s = row.original;
        if (!s.has_errors && !s.has_rage_clicks) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        /* Two 6px dots stacked in the Location column used to carry this, which
           needed a tooltip to mean anything. Labelled chips say it outright. */
        return (
          <div className="flex flex-wrap items-center gap-1">
            {s.has_errors && (
              <span className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:text-red-300">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                Errors
              </span>
            )}
            {s.has_rage_clicks && (
              <span className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                <MousePointerClick className="h-3 w-3 shrink-0" />
                Rage
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: 'when',
      header: ({ column }) => <SortableHeader column={column}>Recorded</SortableHeader>,
      accessorKey: 'start_time',
      size: 104,
      cell: ({ getValue }) => (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
          <Clock className="size-3.5 shrink-0 opacity-60" aria-hidden />
          {timeAgo(getValue() as string)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      size: 120,
      cell: ({ row }) => (
        <div className="flex justify-end items-center gap-1 pr-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-foreground hover:bg-muted"
            title="Watch replay"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/websites/${websiteId}/replays/${row.original.session_id}`);
            }}
          >
            <Play className="h-3.5 w-3.5 fill-current" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            title="Delete session"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('Delete this session?')) {
                deleteMutation.mutate([row.original.session_id]);
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ], [deleteMutation, router, websiteId]);






  return (
    <div className="w-full max-w-[1440px] mx-auto p-4 md:p-6 lg:p-8">
      <DashboardPageHeader
        websiteId={websiteId}
        title="Session Replays"
        description="Watch real user sessions to understand exactly how people use your product."
      >
        {!isDemoMode && (
          <Button variant="default" size="sm" className="gap-1.5" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        )}
      </DashboardPageHeader>

      <StatCards cards={[
        { label: 'Total Sessions', value: allSessions.length, icon: Users, tone: 'info' },
        { label: 'Avg Duration', value: avgDuration > 0 ? formatDuration(avgDuration) : '—', icon: Clock, tone: 'accent' },
        { label: 'With Errors', value: withErrors, icon: AlertTriangle, tone: 'danger', toneWhen: withErrors > 0 },
        { label: 'Rage clicks', value: withRage, icon: MousePointerClick, tone: 'warning', toneWhen: withRage > 0 },
      ]} />

      <DataTable
        className=" shadow-sm rounded-lg overflow-hidden [&_tbody_tr]:transition-colors [&_tbody_td]:align-middle [&_td]:!py-3.5 [&_th]:!py-3.5"
        data={filtered}
        columns={columns}
        isLoading={isLoading}
        rowClassName={() => 'hover:bg-muted/35'}
        enableRowSelection={true}
        selectionActions={(selectedRows) => (
          <>
            <span className="text-sm font-medium text-muted-foreground mr-2">
              {selectedRows.length} selected
            </span>
            <Button
              variant="destructive"
              size="sm"
              className="h-8 gap-1.5"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (confirm(`Are you sure you want to delete ${selectedRows.length} session(s)?`)) {
                  deleteMutation.mutate(selectedRows.map(r => r.session_id));
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </>
        )}
        /* No title: `DashboardPageHeader` above already says "Session Replays", and
           "Recorded sessions" under it was the page's second heading for one list. */
        toolbarLeft={
          <p className="text-xs text-muted-foreground">
            {filtered.length === allSessions.length
              ? `${allSessions.length} session${allSessions.length === 1 ? '' : 's'} recorded`
              : `${filtered.length} of ${allSessions.length} shown`}
          </p>
        }
        toolbarRight={
          <>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search sessions…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-8 w-52 pl-8 text-xs"
              />
            </div>
            <Select value={deviceFilter} onValueChange={setDeviceFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All devices</SelectItem>
                <SelectItem value="desktop" className="text-xs">Desktop</SelectItem>
                <SelectItem value="mobile" className="text-xs">Mobile</SelectItem>
                <SelectItem value="tablet" className="text-xs">Tablet</SelectItem>
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
        pageSize={10}
      />

    </div>
  );
}
