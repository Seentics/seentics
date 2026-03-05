'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Loader2, Play, Clock, Laptop, Trash2, Monitor, Smartphone,
  Tablet, ArrowLeft, Settings, Search, RefreshCw, PlayCircle, X, MapPin,
} from 'lucide-react';
import { cn } from "@/lib/utils";
import Link from 'next/link';
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatDistanceToNow } from 'date-fns';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import ReplayPlayer from './ReplayPlayer';
import api from '@/lib/api';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { DataTable, ColumnDef, SortableHeader, selectionColumn } from '@/components/ui/data-table';

interface ReplaySessionMetadata {
  session_id: string;
  website_id: string;
  start_time: string;
  end_time: string;
  duration_seconds: number;
  chunk_count: number;
  browser: string;
  device: string;
  os: string;
  country: string;
  entry_page: string;
}

interface ReplaysOverviewProps {
  websiteId: string;
}

function val(v: string | undefined | null, fallback = '—'): string {
  if (!v || v === 'Unknown') return fallback;
  return v;
}

function formatDuration(seconds: number): string {
  const s = Math.min(Math.round(seconds), 1800); // cap at 30 min
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m === 0) return `${sec}s`;
  if (sec === 0) return `${m}m`;
  return `${m}m ${sec}s`;
}

function getDeviceIcon(device: string) {
  if (!device) return Monitor;
  const d = device.toLowerCase();
  if (d.includes('mobile') || d.includes('phone')) return Smartphone;
  if (d.includes('tablet') || d.includes('ipad')) return Tablet;
  return Monitor;
}

function getEntryPageLabel(entryPage: string): string {
  if (!entryPage || entryPage === '/') return 'Homepage';
  const segments = entryPage.split('/').filter(Boolean);
  const last = segments[segments.length - 1];
  if (/^[0-9a-f]{8}-[0-9a-f]{4}/.test(last) && segments.length > 1) {
    return segments[segments.length - 2].charAt(0).toUpperCase() + segments[segments.length - 2].slice(1);
  }
  return last.charAt(0).toUpperCase() + last.slice(1).replace(/-/g, ' ');
}

export default function ReplaysOverview({ websiteId }: ReplaysOverviewProps) {
  const [sessions, setSessions] = useState<ReplaySessionMetadata[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selectedSessions, setSelectedSessions] = useState<ReplaySessionMetadata[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterDevice, setFilterDevice] = useState('all');

  const fetchSessions = useCallback(async (cursor?: string) => {
    try {
      if (cursor) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }

      const params = new URLSearchParams({ website_id: websiteId, limit: '50' });
      if (cursor) params.set('before', cursor);

      const response = await api.get(`/replays/sessions?${params}`);
      const data = response.data;
      const incoming: ReplaySessionMetadata[] = data.sessions || [];

      if (cursor) {
        setSessions(prev => [...prev, ...incoming]);
      } else {
        setSessions(incoming);
      }

      setTotal(data.total ?? incoming.length);
      setHasMore(data.has_more ?? false);
      setNextCursor(data.next_cursor ?? null);
    } catch (err: any) {
      if (!cursor) {
        setError(err?.response?.data?.error || err.message || 'Failed to fetch sessions');
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [websiteId]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const hasActiveFilters = searchQuery !== '' || filterDevice !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setFilterDevice('all');
  };

  const stats = useMemo(() => {
    if (sessions.length === 0) return { total: 0, avgDuration: '0s', topEnv: '—' };
    const avgSeconds = sessions.reduce((acc, s) => acc + s.duration_seconds, 0) / sessions.length;
    const browsers: Record<string, number> = {};
    sessions.forEach(s => { if (s.browser && s.browser !== 'Unknown') browsers[s.browser] = (browsers[s.browser] || 0) + 1; });
    const topBrowser = Object.entries(browsers).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
    return { total: sessions.length, avgDuration: formatDuration(avgSeconds), topEnv: topBrowser };
  }, [sessions]);

  const filteredSessions = useMemo(() =>
    sessions.filter(s => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !s.entry_page?.toLowerCase().includes(q) &&
          !s.session_id?.toLowerCase().includes(q) &&
          !s.browser?.toLowerCase().includes(q) &&
          !s.country?.toLowerCase().includes(q) &&
          !s.os?.toLowerCase().includes(q)
        ) return false;
      }
      if (filterDevice !== 'all' && s.device?.toLowerCase() !== filterDevice.toLowerCase()) return false;
      return true;
    }),
    [sessions, searchQuery, filterDevice]
  );

  const handleDelete = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this recording?')) return;
    try {
      setDeleting(sessionId);
      await api.delete(`/replays/sessions/${sessionId}?website_id=${websiteId}`);
      setSessions(prev => prev.filter(s => s.session_id !== sessionId));
      setSelectedSessions(prev => prev.filter(s => s.session_id !== sessionId));
      setTotal(prev => Math.max(0, prev - 1));
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to delete recording');
    } finally {
      setDeleting(null);
    }
  };

  const handleBulkDelete = async (rows: ReplaySessionMetadata[]) => {
    if (rows.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${rows.length} recording${rows.length > 1 ? 's' : ''}?`)) return;
    const ids = rows.map(s => s.session_id);
    try {
      await api.delete('/replays/bulk-delete', { data: { website_id: websiteId, session_ids: ids } });
      setSessions(prev => prev.filter(s => !ids.includes(s.session_id)));
      setSelectedSessions([]);
      setTotal(prev => Math.max(0, prev - ids.length));
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to delete selected recordings');
    }
  };

  const columns = useMemo((): ColumnDef<ReplaySessionMetadata>[] => [
    selectionColumn<ReplaySessionMetadata>(),
    {
      id: 'session',
      header: 'Session',
      cell: ({ row }) => {
        const s = row.original;
        return (
          <div className="flex items-center gap-3 min-w-0 pl-1">
            <div className="h-9 w-9 rounded-lg bg-primary/5 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors">
              <Play className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{getEntryPageLabel(s.entry_page)}</p>
              <p className="text-xs text-muted-foreground/60 font-mono truncate mt-0.5">{s.session_id?.slice(0, 12)}...</p>
            </div>
          </div>
        );
      },
    },
    {
      id: 'platform',
      header: 'Platform',
      size: 100,
      cell: ({ row }) => {
        const s = row.original;
        const DeviceIcon = getDeviceIcon(s.device);
        return (
          <div className="flex items-center justify-center gap-2">
            <DeviceIcon className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">{val(s.browser)}</p>
              <p className="text-[10px] text-muted-foreground/50">{val(s.device, 'Desktop')}</p>
            </div>
          </div>
        );
      },
    },
    {
      id: 'location',
      header: 'Location',
      size: 100,
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-1.5">
          <MapPin className="h-3 w-3 text-muted-foreground/40 flex-shrink-0" />
          <span className="text-xs">{val(row.original.country)}</span>
        </div>
      ),
    },
    {
      accessorKey: 'duration_seconds',
      header: ({ column }) => <SortableHeader column={column}>Duration</SortableHeader>,
      size: 90,
      cell: ({ row }) => (
        <div className="text-center">
          <span className="text-sm font-semibold tabular-nums">{formatDuration(row.original.duration_seconds)}</span>
        </div>
      ),
    },
    {
      accessorKey: 'start_time',
      header: ({ column }) => <SortableHeader column={column}>Time</SortableHeader>,
      size: 140,
      cell: ({ row }) => {
        const timeAgo = (() => {
          try {
            const date = new Date(row.original.start_time);
            if (!row.original.start_time || isNaN(date.getTime())) return 'Just now';
            return formatDistanceToNow(date, { addSuffix: true });
          } catch { return 'Just now'; }
        })();
        return <div className="text-center"><span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo}</span></div>;
      },
    },
    {
      id: 'actions',
      header: '',
      size: 100,
      enableSorting: false,
      cell: ({ row }) => {
        const session = row.original;
        return (
          <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon"
                    className="h-7 w-7 text-muted-foreground/50 hover:text-rose-500 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all"
                    onClick={() => handleDelete(session.session_id)}
                    disabled={deleting === session.session_id}>
                    {deleting === session.session_id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">Delete</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button variant="secondary" size="sm"
              className="h-7 gap-1.5 px-2.5 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-all shadow-sm border border-primary/10"
              onClick={() => setSelectedSession(session.session_id)}>
              <Play className="h-3 w-3 fill-current" /> Play
            </Button>
          </div>
        );
      },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [deleting]);

  // ---- Session player view ----
  if (selectedSession) {
    const session = sessions.find(s => s.session_id === selectedSession);
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedSession(null)} className="h-8 w-8 hover:bg-muted">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="h-4 w-px bg-border" />
          <div>
            <h3 className="text-sm font-medium">
              Session Replay
              {session && <span className="text-muted-foreground ml-1.5">· {val(session.entry_page, 'Unknown page')}</span>}
            </h3>
            <p className="text-xs text-muted-foreground font-mono">{selectedSession.slice(0, 16)}...</p>
          </div>
        </div>
        <ReplayPlayer sessionId={selectedSession} websiteId={websiteId} session={session} />
      </div>
    );
  }

  // ---- Loading state ----
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/40" />
        <span className="text-sm font-medium text-muted-foreground">Loading session recordings...</span>
      </div>
    );
  }

  // ---- Main overview ----
  return (
    <div className="space-y-6 pb-12">
      <DashboardPageHeader
        title="Session Recordings"
        description="Watch how users interact with your site to identify friction and opportunity."
        icon={PlayCircle}
      >
        <Link href={`/websites/${websiteId}/settings?tab=replays`}>
          <Button variant="outline" className="gap-2 h-9 text-xs font-medium">
            <Settings className="h-3.5 w-3.5" /> Settings
          </Button>
        </Link>
        <Button variant="outline" className="gap-2 h-9 text-xs font-medium" onClick={() => fetchSessions()} disabled={loading}>
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Refresh
        </Button>
      </DashboardPageHeader>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard title="Total Sessions" value={total} icon={PlayCircle} description="Recorded sessions" color="blue" />
        <StatsCard title="Avg. Duration" value={stats.avgDuration} icon={Clock} description="Mean session length" color="emerald" />
        <StatsCard title="Top Browser" value={stats.topEnv} icon={Laptop} description="Most common browser" color="violet" />
      </div>

      {/* Sessions table */}
      {sessions.length === 0 ? (
        <Card className="border border-dashed border-border/60 bg-card">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-14 w-14 bg-muted/40 rounded-2xl flex items-center justify-center mb-4">
              <Play className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <h3 className="text-sm font-semibold">No recordings yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1">
              No replay sessions have been captured. Ensure the tracker is installed and recording is enabled.
            </p>
            <Link href={`/websites/${websiteId}/settings?tab=replays`} className="mt-4">
              <Button variant="outline" size="sm" className="gap-2 text-xs">
                <Settings className="h-3.5 w-3.5" /> Configure Recording
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <DataTable
            columns={columns}
            data={filteredSessions}
            enableRowSelection
            onRowSelectionChange={setSelectedSessions}
            onRowClick={(session) => setSelectedSession(session.session_id)}
            selectionActions={(rows) => (
              <Button
                variant="destructive"
                size="sm"
                className="h-8 gap-1.5 px-3 text-xs font-medium"
                onClick={() => handleBulkDelete(rows)}
              >
                <Trash2 className="h-3 w-3" />
                Delete ({rows.length})
              </Button>
            )}
            toolbarLeft={
              <div>
                <h3 className="text-base font-semibold text-foreground">Sessions</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {filteredSessions.length}{' '}
                  {filteredSessions.length === 1 ? 'recording' : 'recordings'}
                  {hasActiveFilters && ` (filtered from ${sessions.length})`}
                  {total > sessions.length && !hasActiveFilters && ` of ${total}`}
                </p>
              </div>
            }
            toolbarRight={
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search sessions..."
                    className="pl-8 w-full md:w-[240px] h-8 text-sm bg-muted/30 border-border/50 focus-visible:ring-1 focus-visible:ring-primary/30"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={filterDevice} onValueChange={setFilterDevice}>
                  <SelectTrigger className="w-[130px] h-8 text-xs bg-muted/30 border-border/50">
                    <Monitor className="h-3 w-3 mr-1.5 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All devices</SelectItem>
                    <SelectItem value="desktop">Desktop</SelectItem>
                    <SelectItem value="mobile">Mobile</SelectItem>
                    <SelectItem value="tablet">Tablet</SelectItem>
                  </SelectContent>
                </Select>
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
                    onClick={clearFilters}
                  >
                    <X className="h-3 w-3" /> Clear
                  </Button>
                )}
              </div>
            }
            emptyIcon={<Search className="h-6 w-6 text-muted-foreground/20" />}
            emptyTitle="No sessions match your filters"
            emptyDescription="Try a different search or clear the active filters."
            emptyAction={
              <Button variant="ghost" size="sm" className="text-xs mt-2" onClick={clearFilters}>
                Clear filters
              </Button>
            }
            isLoading={loading}
          />

          {/* Load more */}
          {hasMore && !hasActiveFilters && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-xs"
                onClick={() => nextCursor && fetchSessions(nextCursor)}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Load more sessions
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatsCard({ title, value, icon: Icon, description, color = 'blue' }: { title: string; value: string | number; icon: any; description: string; color?: string }) {
  const bgMap: Record<string, string> = {
    blue: 'bg-blue-500/10',
    emerald: 'bg-emerald-500/10',
    violet: 'bg-violet-500/10',
    amber: 'bg-amber-500/10',
  };
  const iconMap: Record<string, string> = {
    blue: 'text-blue-500',
    emerald: 'text-emerald-500',
    violet: 'text-violet-500',
    amber: 'text-amber-500',
  };
  return (
    <Card className="border border-border/60 bg-card shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-semibold tracking-tight">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <div className={cn('shrink-0 h-9 w-9 rounded-lg flex items-center justify-center', bgMap[color])}>
            <Icon className={cn('h-4 w-4', iconMap[color])} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
