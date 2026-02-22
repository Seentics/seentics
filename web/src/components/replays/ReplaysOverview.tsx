'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Loader2, Play, Clock, Laptop, Trash2, Monitor, Smartphone,
  Tablet, ArrowLeft, Settings, ChevronLeft, ChevronRight,
  Search, RefreshCw, PlayCircle, ArrowUpDown, X, MapPin,
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
import { Checkbox } from "@/components/ui/checkbox";
import ReplayPlayer from './ReplayPlayer';
import api from '@/lib/api';
import { DashboardPageHeader } from '@/components/dashboard-header';

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

type SortKey = 'date' | 'duration' | 'chunks';
type SortDir = 'asc' | 'desc';

function val(v: string | undefined | null, fallback = '—'): string {
  if (!v || v === 'Unknown') return fallback;
  return v;
}

function getPaginationRange(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, '...', total];
  if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '...', current - 1, current, current + 1, '...', total];
}

function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  // Filters — simplified to just search + device
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDevice, setFilterDevice] = useState('all');

  // Sort
  const [sortBy, setSortBy] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/replays/sessions?website_id=${websiteId}`);
      setSessions(response.data.sessions || []);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Failed to fetch sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSessions(); }, [websiteId]);

  const hasActiveFilters = searchQuery !== '' || filterDevice !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setFilterDevice('all');
  };

  const stats = useMemo(() => {
    if (sessions.length === 0) return { total: 0, avgDuration: '0s', topEnv: '—' };
    const total = sessions.length;
    const avgSeconds = sessions.reduce((acc, s) => acc + s.duration_seconds, 0) / total;
    const browsers: Record<string, number> = {};
    sessions.forEach(s => { if (s.browser && s.browser !== 'Unknown') browsers[s.browser] = (browsers[s.browser] || 0) + 1; });
    const topBrowser = Object.entries(browsers).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
    return { total, avgDuration: formatDuration(avgSeconds), topEnv: topBrowser };
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    let result = sessions.filter(s => {
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
    });

    const dir = sortDir === 'asc' ? 1 : -1;
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'duration': return (a.duration_seconds - b.duration_seconds) * dir;
        case 'chunks':   return (a.chunk_count - b.chunk_count) * dir;
        case 'date':
        default:
          return (new Date(a.start_time).getTime() - new Date(b.start_time).getTime()) * dir;
      }
    });

    return result;
  }, [sessions, searchQuery, filterDevice, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / itemsPerPage));
  const paginatedSessions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSessions.slice(start, start + itemsPerPage);
  }, [filteredSessions, currentPage, itemsPerPage]);

  const paginationRange = getPaginationRange(currentPage, totalPages);

  useEffect(() => { setCurrentPage(1); }, [searchQuery, filterDevice, itemsPerPage]);

  const handleDelete = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this recording?')) return;
    try {
      setDeleting(sessionId);
      await api.delete(`/replays/sessions/${sessionId}?website_id=${websiteId}`);
      setSessions(sessions.filter(s => s.session_id !== sessionId));
      setSelectedSessionIds(prev => prev.filter(id => id !== sessionId));
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to delete recording');
    } finally {
      setDeleting(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedSessionIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedSessionIds.length} recordings?`)) return;

    try {
      setIsDeletingBulk(true);
      await api.delete('/replays/bulk-delete', {
        data: {
          website_id: websiteId,
          session_ids: selectedSessionIds
        }
      });
      setSessions(sessions.filter(s => !selectedSessionIds.includes(s.session_id)));
      setSelectedSessionIds([]);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to delete selected recordings');
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedSessionIds.length === paginatedSessions.length) {
      setSelectedSessionIds([]);
    } else {
      setSelectedSessionIds(paginatedSessions.map(s => s.session_id));
    }
  };

  const toggleSelectSession = (sessionId: string) => {
    setSelectedSessionIds(prev =>
      prev.includes(sessionId)
        ? prev.filter(id => id !== sessionId)
        : [...prev, sessionId]
    );
  };

  const handleSortChange = (key: SortKey) => {
    if (key === sortBy) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('desc'); }
    setCurrentPage(1);
  };

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
      {/* Header */}
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
        <Button variant="outline" className="gap-2 h-9 text-xs font-medium" onClick={fetchSessions}>
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Refresh
        </Button>
      </DashboardPageHeader>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard title="Total Sessions" value={stats.total} icon={PlayCircle} description="Recorded sessions" color="blue" />
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
        <Card className="border border-border/60 bg-card shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="px-5 py-4 border-b border-border/40">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-foreground">Sessions</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {filteredSessions.length} {filteredSessions.length === 1 ? 'recording' : 'recordings'}
                  {hasActiveFilters && ` (filtered from ${sessions.length})`}
                </p>
              </div>
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
                  <SelectTrigger className="w-[120px] h-8 text-xs bg-muted/30 border-border/50">
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

                <Select value={sortBy} onValueChange={(v) => handleSortChange(v as SortKey)}>
                  <SelectTrigger className="w-[130px] h-8 text-xs bg-muted/30 border-border/50">
                    <ArrowUpDown className="h-3 w-3 mr-1.5 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Newest first</SelectItem>
                    <SelectItem value="duration">Duration</SelectItem>
                    <SelectItem value="chunks">Steps</SelectItem>
                  </SelectContent>
                </Select>

                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={clearFilters}>
                    <X className="h-3 w-3" /> Clear
                  </Button>
                )}

                {selectedSessionIds.length > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8 gap-1.5 px-3 text-xs font-medium animate-in zoom-in-95 duration-200"
                    onClick={handleBulkDelete}
                    disabled={isDeletingBulk}
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete ({selectedSessionIds.length})
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[40px_1fr_100px_100px_90px_90px_100px] items-center px-5 py-2.5 border-b border-border/30 bg-muted/10 text-xs font-medium text-muted-foreground">
            <div className="flex items-center justify-center">
              <Checkbox
                checked={paginatedSessions.length > 0 && selectedSessionIds.length === paginatedSessions.length}
                onCheckedChange={toggleSelectAll}
                aria-label="Select all sessions"
              />
            </div>
            <div className="pl-1">Session</div>
            <div className="text-center">Platform</div>
            <div className="text-center">Location</div>
            <div
              className="text-center cursor-pointer select-none hover:text-foreground transition-colors"
              onClick={() => handleSortChange('duration')}
            >
              Duration {sortBy === 'duration' && (sortDir === 'desc' ? '\u2193' : '\u2191')}
            </div>
            <div
              className="text-center cursor-pointer select-none hover:text-foreground transition-colors"
              onClick={() => handleSortChange('date')}
            >
              Time {sortBy === 'date' && (sortDir === 'desc' ? '\u2193' : '\u2191')}
            </div>
            <div />
          </div>

          {/* Rows */}
          {paginatedSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Search className="h-6 w-6 text-muted-foreground/20 mb-3" />
              <span className="text-sm text-muted-foreground">No sessions match your filters</span>
              <Button variant="ghost" size="sm" className="text-xs mt-2" onClick={clearFilters}>Clear filters</Button>
            </div>
          ) : (
            <div className="divide-y divide-border/20">
              {paginatedSessions.map((session) => {
                const DeviceIcon = getDeviceIcon(session.device);
                const timeAgo = (() => {
                  try {
                    const date = new Date(session.start_time);
                    if (!session.start_time || isNaN(date.getTime())) return 'Just now';
                    return formatDistanceToNow(date, { addSuffix: true });
                  } catch { return 'Just now'; }
                })();

                return (
                  <div
                    key={session.session_id}
                    className={cn(
                      "group grid grid-cols-[40px_1fr_100px_100px_90px_90px_100px] items-center px-5 py-3 transition-colors cursor-pointer hover:bg-muted/20",
                      selectedSessionIds.includes(session.session_id) && "bg-primary/[0.03]"
                    )}
                    onClick={() => setSelectedSession(session.session_id)}
                  >
                    {/* Checkbox */}
                    <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedSessionIds.includes(session.session_id)}
                        onCheckedChange={() => toggleSelectSession(session.session_id)}
                        aria-label={`Select session ${session.session_id}`}
                      />
                    </div>

                    {/* Session info */}
                    <div className="flex items-center gap-3 min-w-0 pl-1">
                      <div className="h-9 w-9 rounded-lg bg-primary/5 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors">
                        <Play className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                          {getEntryPageLabel(session.entry_page)}
                        </p>
                        <p className="text-xs text-muted-foreground/60 font-mono truncate mt-0.5">
                          {session.session_id?.slice(0, 12)}...
                        </p>
                      </div>
                    </div>

                    {/* Platform — merged browser + device */}
                    <div className="flex items-center justify-center gap-2">
                      <DeviceIcon className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{val(session.browser)}</p>
                        <p className="text-[10px] text-muted-foreground/50">{val(session.device, 'Desktop')}</p>
                      </div>
                    </div>

                    {/* Location */}
                    <div className="flex items-center justify-center gap-1.5">
                      <MapPin className="h-3 w-3 text-muted-foreground/40 flex-shrink-0" />
                      <span className="text-xs truncate">{val(session.country)}</span>
                    </div>

                    {/* Duration */}
                    <div className="text-center">
                      <span className="text-sm font-semibold tabular-nums">{formatDuration(session.duration_seconds)}</span>
                    </div>

                    {/* Time ago */}
                    <div className="text-center">
                      <span className="text-xs text-muted-foreground">{timeAgo}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost" size="icon"
                              className="h-7 w-7 text-muted-foreground/50 hover:text-rose-500 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all"
                              onClick={() => handleDelete(session.session_id)}
                              disabled={deleting === session.session_id}
                            >
                              {deleting === session.session_id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Trash2 className="h-3.5 w-3.5" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left">Delete</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-primary hover:bg-primary/10"
                        onClick={() => setSelectedSession(session.session_id)}
                      >
                        <Play className="h-3 w-3" /> Play
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          <div className="px-5 py-3 border-t border-border/30 flex flex-col sm:flex-row items-center justify-between gap-3 bg-muted/5">
            <p className="text-xs text-muted-foreground">
              {filteredSessions.length === 0
                ? 'No results'
                : `${(currentPage - 1) * itemsPerPage + 1}–${Math.min(currentPage * itemsPerPage, filteredSessions.length)} of ${filteredSessions.length} sessions`}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                {paginationRange.map((item, idx) =>
                  item === '...' ? (
                    <span key={`e-${idx}`} className="h-7 w-7 flex items-center justify-center text-xs text-muted-foreground">…</span>
                  ) : (
                    <Button
                      key={item}
                      variant={currentPage === item ? "default" : "ghost"}
                      size="icon"
                      className={cn("h-7 w-7 text-xs", currentPage === item && "pointer-events-none")}
                      onClick={() => setCurrentPage(item as number)}
                    >
                      {item}
                    </Button>
                  )
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function StatsCard({ title, value, icon: Icon, description, color = 'blue' }: { title: string; value: string | number; icon: any; description: string; color?: string }) {
  const accentMap: Record<string, string> = {
    blue: 'bg-blue-500',
    emerald: 'bg-emerald-500',
    violet: 'bg-violet-500',
    amber: 'bg-amber-500',
  };
  const iconMap: Record<string, string> = {
    blue: 'text-blue-500',
    emerald: 'text-emerald-500',
    violet: 'text-violet-500',
    amber: 'text-amber-500',
  };
  return (
    <Card className="relative overflow-hidden border border-border/60 bg-card shadow-sm">
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentMap[color]}`} />
      <CardHeader className="pb-1 pl-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{title}</span>
          <Icon className={cn("h-4 w-4", iconMap[color])} />
        </div>
      </CardHeader>
      <CardContent className="pl-5 pt-0">
        <div className="text-2xl font-semibold tracking-tight">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </CardContent>
    </Card>
  );
}
