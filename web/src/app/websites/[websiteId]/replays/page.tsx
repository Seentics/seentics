'use client';

import { useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { DataTable, SortableHeader, ColumnDef, selectionColumn } from '@/components/ui/data-table';
import { StatCards } from '@/components/seentics-ui/StatCards';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Video,
  Clock,
  Monitor,
  Smartphone,
  Tablet,
  AlertTriangle,
  Search,
  Users,
  RefreshCw,
  Trash2,
  Play,
  Copy,
  MousePointerClick,
} from 'lucide-react';
import { isDemo } from '@/lib/demo';
import { demoReplays } from '@/lib/demo/replays';
import { listSessions, deleteSessions, type ReplaySession } from '@/lib/replays-api';
import { useToast } from '@/hooks/use-toast';


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

  const copySessionId = useCallback(
    (id: string) => {
      void navigator.clipboard.writeText(id).then(() => {
        toast({ title: 'Session ID copied' });
      });
    },
    [toast],
  );

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
    staleTime: 30_000,
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
      has_errors: false,
      has_rage_clicks: s.hasRageClicks,
      start_time: s.startedAt,
    }));

  }, [isDemoMode, apiData]);

  const filtered = useMemo(() =>
    allSessions.filter(s => {
      if (deviceFilter !== 'all' && s.device.toLowerCase() !== deviceFilter) return false;
      if (
        search &&
        ![s.country, s.browser, s.entry_page, s.session_id].some(v =>
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
      header: ({ column }) => <SortableHeader column={column}>Country</SortableHeader>,
      size: 200,
      cell: ({ row }) => {
        const s = row.original;
        return (
          <div className="flex items-center gap-3 py-1">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground tracking-tight">{s.country}</span>
                {(s.has_errors || s.has_rage_clicks) && (
                  <div className="flex gap-1 items-center">
                    {s.has_rage_clicks && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />}
                    {s.has_errors && <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground/80 font-semibold uppercase tracking-wider">
                <DeviceIcon device={s.device} />
                <span>{s.browser}</span>
                <span className="opacity-40">•</span>
                <span>{s.os}</span>
              </div>
            </div>
          </div>
        );
      },
    },
    {
      id: 'entry_page',
      header: 'Entry Page',
      accessorKey: 'entry_page',
      size: 350,
      cell: ({ getValue }) => (
        <div className="max-w-[350px] truncate group">
          <span className="font-mono text-[11px] text-muted-foreground group-hover:text-primary transition-colors cursor-default">
            {getValue() as string}
          </span>
        </div>
      ),
    },
    {
      id: 'duration',
      header: ({ column }) => <SortableHeader column={column}>Duration</SortableHeader>,
      accessorKey: 'duration_seconds',
      size: 110,
      cell: ({ getValue }) => {
        const v = getValue() as number;
        return (
          <div className="flex items-center gap-1.5 text-xs text-foreground font-medium bg-muted/30 w-fit px-2 py-0.5 rounded-md border border-border/40">
            <Clock className="h-3 w-3 text-muted-foreground" />
            {v > 0 ? formatDuration(v) : '0s'}
          </div>
        );
      },
    },
    {
      id: 'when',
      header: 'When',
      accessorKey: 'start_time',
      size: 130,

      cell: ({ getValue }) => (
        <span className="text-xs text-muted-foreground font-medium">{timeAgo(getValue() as string)}</span>
      ),
    },
    {
      id: 'actions',
      header: '',
      size: 108,
      cell: ({ row }) => (
        <div className="flex justify-end items-center gap-0.5 pr-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-primary"
            title="Copy session ID"
            onClick={(e) => {
              e.stopPropagation();
              copySessionId(row.original.session_id);
            }}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-primary hover:bg-primary/10"
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
            className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full"
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
  ], [deleteMutation, copySessionId, router, websiteId]);






  return (
    <div className="w-full max-w-[1440px] mx-auto p-4 md:p-6 lg:p-8">
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
        { label: 'Avg Duration', value: avgDuration > 0 ? formatDuration(avgDuration) : '—', icon: Clock, iconColor: 'text-blue-600', valueColor: 'text-blue-600' },
        { label: 'With Errors', value: withErrors, icon: AlertTriangle, iconColor: 'text-red-500', valueColor: withErrors > 0 ? 'text-red-500' : undefined },
        {
          label: 'Rage clicks',
          value: withRage,
          icon: MousePointerClick,
          iconColor: 'text-orange-500',
          valueColor: withRage > 0 ? 'text-orange-500' : undefined,
        },
      ]} />

      <DataTable
        data={filtered}
        columns={columns}
        isLoading={isLoading}
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
                placeholder="Search country, browser, page, session ID…"
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
        pageSize={15}
      />

    </div>
  );
}
