'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Loader2, Play, Clock, Laptop, Trash2, Monitor, Smartphone,
  Tablet, ArrowLeft, Settings, ChevronLeft, ChevronRight,
  Search, RefreshCw, PlayCircle, Globe, SortAsc, SortDesc,
  Filter, X, TrendingUp
} from 'lucide-react';
import { cn } from "@/lib/utils";
import Link from 'next/link';
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatDistanceToNow } from 'date-fns';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import ReplayPlayer from './ReplayPlayer';
import api from '@/lib/api';

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

// Treat the string "Unknown" returned by COALESCE the same as null/empty
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

const StatsCard = ({ title, value, icon: Icon, description, color = 'primary' }: { title: string; value: string | number; icon: any; description: string; color?: string }) => {
  const colorClasses: Record<string, string> = {
    primary: 'text-primary bg-primary/10',
    green: 'text-green-500 bg-green-500/10',
    blue: 'text-blue-500 bg-blue-500/10',
    purple: 'text-purple-500 bg-purple-500/10',
  };
  return (
    <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none bg-card dark:bg-gray-800/50 rounded overflow-hidden border border-muted-foreground/5 flex flex-col justify-between">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardDescription className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">{title}</CardDescription>
          <div className={`p-2 rounded ${colorClasses[color]}`}><Icon className="h-4 w-4" /></div>
        </div>
        <CardTitle className="text-2xl font-black text-slate-900 dark:text-white mt-2">{value}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-[11px] font-bold text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
};

export default function ReplaysOverview({ websiteId }: ReplaysOverviewProps) {
  const [sessions, setSessions] = useState<ReplaySessionMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDevice, setFilterDevice] = useState('all');
  const [filterBrowser, setFilterBrowser] = useState('all');
  const [filterOS, setFilterOS] = useState('all');
  const [minDuration, setMinDuration] = useState('');

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

  // Derived filter options from data
  const deviceOptions = useMemo(() => {
    const vals = [...new Set(sessions.map(s => s.device).filter(Boolean))];
    return vals.sort();
  }, [sessions]);

  const browserOptions = useMemo(() => {
    const vals = [...new Set(sessions.map(s => s.browser).filter(Boolean))];
    return vals.sort();
  }, [sessions]);

  const osOptions = useMemo(() => {
    const vals = [...new Set(sessions.map(s => s.os).filter(Boolean))];
    return vals.sort();
  }, [sessions]);

  const activeFilterCount = [
    filterDevice !== 'all',
    filterBrowser !== 'all',
    filterOS !== 'all',
    minDuration !== '',
    searchQuery !== '',
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSearchQuery('');
    setFilterDevice('all');
    setFilterBrowser('all');
    setFilterOS('all');
    setMinDuration('');
  };

  const stats = useMemo(() => {
    if (sessions.length === 0) return { total: 0, avgDuration: '0s', topEnv: 'N/A' };
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
      if (filterBrowser !== 'all' && s.browser !== filterBrowser) return false;
      if (filterOS !== 'all' && s.os !== filterOS) return false;
      if (minDuration) {
        const minSec = parseInt(minDuration);
        if (!isNaN(minSec) && s.duration_seconds < minSec) return false;
      }
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
  }, [sessions, searchQuery, filterDevice, filterBrowser, filterOS, minDuration, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / itemsPerPage));
  const paginatedSessions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSessions.slice(start, start + itemsPerPage);
  }, [filteredSessions, currentPage, itemsPerPage]);

  const paginationRange = getPaginationRange(currentPage, totalPages);

  useEffect(() => { setCurrentPage(1); }, [searchQuery, filterDevice, filterBrowser, filterOS, minDuration, itemsPerPage]);

  const handleDelete = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this recording?')) return;
    try {
      setDeleting(sessionId);
      await api.delete(`/replays/sessions/${sessionId}?website_id=${websiteId}`);
      setSessions(sessions.filter(s => s.session_id !== sessionId));
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to delete recording');
    } finally {
      setDeleting(null);
    }
  };

  const getDeviceIcon = (device: string) => {
    if (!device) return Monitor;
    const d = device.toLowerCase();
    if (d.includes('mobile') || d.includes('phone')) return Smartphone;
    if (d.includes('tablet') || d.includes('ipad')) return Tablet;
    return Monitor;
  };

  const handleSortChange = (key: SortKey) => {
    if (key === sortBy) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('desc'); }
    setCurrentPage(1);
  };

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortBy === col ? (sortDir === 'desc' ? <SortDesc className="h-3 w-3 inline ml-1" /> : <SortAsc className="h-3 w-3 inline ml-1" />) : null;

  if (selectedSession) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => setSelectedSession(null)} className="group border font-bold px-4 rounded-lg h-9 text-xs">
            <ArrowLeft className="h-3.5 w-3.5 mr-2 group-hover:-translate-x-0.5 transition-transform" />
            Back to Overview
          </Button>
          <div className="h-4 w-px bg-border" />
          <h3 className="font-bold tracking-tight text-lg opacity-90">
            Replaying Session: <span className="text-primary">{selectedSession.slice(0, 8)}</span>
          </h3>
        </div>
        <ReplayPlayer sessionId={selectedSession} websiteId={websiteId} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-32 space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary opacity-40" />
        <span className="text-lg font-black tracking-widest text-muted-foreground uppercase">Syncing Chrono-Logs...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight">Session Recordings</h2>
          <p className="text-muted-foreground font-medium tracking-tight text-sm">
            Watch how users interact with your site to identify points of friction and opportunity.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/websites/${websiteId}/settings?tab=replays`}>
            <Button variant="outline" className="rounded-lg font-bold px-4 h-10 border border-primary/10 hover:border-primary/30 transition-all bg-primary/5 hover:bg-primary/10 text-primary text-sm">
              <Settings className="h-4 w-4 mr-2" /> Configure
            </Button>
          </Link>
          <Button variant="outline" className="rounded-lg font-black px-4 h-10 text-primary text-[10px] uppercase tracking-widest" onClick={fetchSessions}>
            <RefreshCw className={cn("h-3.5 w-3.5 mr-2", loading && "animate-spin")} /> Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard title="Total Captures" value={stats.total} icon={PlayCircle} description="Stored interactions" color="primary" />
        <StatsCard title="Average Retention" value={stats.avgDuration} icon={Clock} description="Mean session length" color="blue" />
        <StatsCard title="Dominant Stack" value={stats.topEnv} icon={Laptop} description="Leading browser" color="purple" />
      </div>

      {/* Sessions Table */}
      {sessions.length === 0 ? (
        <Card className="border-2 border-dashed bg-accent/5 rounded-xl overflow-hidden">
          <CardContent className="flex flex-col items-center justify-center p-20 text-center">
            <div className="p-6 bg-primary/10 rounded-xl mb-6">
              <Play className="h-12 w-12 text-primary opacity-60" />
            </div>
            <CardTitle className="text-2xl font-bold mb-2 tracking-tight">No Recordings Found</CardTitle>
            <CardDescription className="max-w-md mx-auto font-medium text-sm leading-relaxed text-muted-foreground/60">
              No replay sessions have been captured for this website yet. Ensure the tracker is correctly installed and active.
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card/50 border-border/40 overflow-hidden shadow-sm shadow-black/5">
          {/* Filter bar */}
          <CardHeader className="pb-4 border-b border-border/40">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative group flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                  <Input
                    placeholder="Search page, session ID, browser, OS, country..."
                    className="pl-10 bg-muted/20 border-border/40 h-9 font-medium text-xs focus-visible:ring-primary/20"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {/* Device filter */}
                <Select value={filterDevice} onValueChange={setFilterDevice}>
                  <SelectTrigger className="w-[140px] h-9 bg-muted/20 border-border/40 font-bold text-[10px] uppercase tracking-wider">
                    <Monitor className="h-3 w-3 mr-1.5 shrink-0" />
                    <SelectValue placeholder="Device" />
                  </SelectTrigger>
                  <SelectContent className="bg-card font-bold text-xs uppercase tracking-wider">
                    <SelectItem value="all">All Devices</SelectItem>
                    {deviceOptions.map(d => (
                      <SelectItem key={d} value={d.toLowerCase()}>
                        <span className="flex items-center gap-2">
                          {d.toLowerCase().includes('mobile') ? <Smartphone className="h-3 w-3" /> :
                           d.toLowerCase().includes('tablet') ? <Tablet className="h-3 w-3" /> :
                           <Monitor className="h-3 w-3" />}
                          {d}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Browser filter */}
                <Select value={filterBrowser} onValueChange={setFilterBrowser}>
                  <SelectTrigger className="w-[140px] h-9 bg-muted/20 border-border/40 font-bold text-[10px] uppercase tracking-wider">
                    <SelectValue placeholder="Browser" />
                  </SelectTrigger>
                  <SelectContent className="bg-card font-bold text-xs uppercase tracking-wider">
                    <SelectItem value="all">All Browsers</SelectItem>
                    {browserOptions.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>

                {/* OS filter */}
                <Select value={filterOS} onValueChange={setFilterOS}>
                  <SelectTrigger className="w-[140px] h-9 bg-muted/20 border-border/40 font-bold text-[10px] uppercase tracking-wider">
                    <SelectValue placeholder="OS" />
                  </SelectTrigger>
                  <SelectContent className="bg-card font-bold text-xs uppercase tracking-wider">
                    <SelectItem value="all">All OS</SelectItem>
                    {osOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>

                {/* Min duration */}
                <div className="relative w-[130px]">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input
                    type="number"
                    min="0"
                    placeholder="Min secs"
                    className="pl-8 h-9 bg-muted/20 border-border/40 font-bold text-xs"
                    value={minDuration}
                    onChange={(e) => setMinDuration(e.target.value)}
                  />
                </div>

                {/* Sort */}
                <Select value={sortBy} onValueChange={(v) => handleSortChange(v as SortKey)}>
                  <SelectTrigger className="w-[150px] h-9 bg-muted/20 border-border/40 font-bold text-[10px] uppercase tracking-wider">
                    <TrendingUp className="h-3 w-3 mr-1.5 shrink-0" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card font-bold text-xs uppercase tracking-wider">
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="duration">Duration</SelectItem>
                    <SelectItem value="chunks">Steps</SelectItem>
                  </SelectContent>
                </Select>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="icon" className="h-9 w-9 bg-muted/20 border-border/40" onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}>
                        {sortDir === 'desc' ? <SortDesc className="h-4 w-4" /> : <SortAsc className="h-4 w-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{sortDir === 'desc' ? 'Descending' : 'Ascending'}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Items per page */}
                <Select value={String(itemsPerPage)} onValueChange={(v) => setItemsPerPage(Number(v))}>
                  <SelectTrigger className="w-[100px] h-9 bg-muted/20 border-border/40 font-bold text-[10px] uppercase tracking-wider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card font-bold text-xs uppercase tracking-wider">
                    <SelectItem value="10">10 / page</SelectItem>
                    <SelectItem value="25">25 / page</SelectItem>
                    <SelectItem value="50">50 / page</SelectItem>
                  </SelectContent>
                </Select>

                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-xs font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-500/10" onClick={clearFilters}>
                    <X className="h-3.5 w-3.5" /> Clear filters
                    <Badge className="ml-0.5 h-4 w-4 p-0 flex items-center justify-center text-[9px] bg-rose-500 text-white rounded-full">{activeFilterCount}</Badge>
                  </Button>
                )}
              </div>

              {/* Result count */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">
                  {filteredSessions.length} of {sessions.length} sessions
                </span>
              </div>
            </div>
          </CardHeader>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent border-border/40">
                  <TableHead className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap">Session</TableHead>
                  <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center whitespace-nowrap">Platform</TableHead>
                  <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center whitespace-nowrap">OS</TableHead>
                  <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center whitespace-nowrap">Location</TableHead>
                  <TableHead
                    className="py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center whitespace-nowrap cursor-pointer select-none"
                    onClick={() => handleSortChange('duration')}
                  >
                    Duration <SortIcon col="duration" />
                  </TableHead>
                  <TableHead
                    className="py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center whitespace-nowrap cursor-pointer select-none"
                    onClick={() => handleSortChange('chunks')}
                  >
                    Steps <SortIcon col="chunks" />
                  </TableHead>
                  <TableHead
                    className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap cursor-pointer select-none"
                    onClick={() => handleSortChange('date')}
                  >
                    Captured <SortIcon col="date" />
                  </TableHead>
                  <TableHead className="w-[80px] px-6 py-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedSessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-40 text-center">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <Filter className="h-8 w-8 opacity-20" />
                        <span className="text-sm font-bold">No sessions match your filters</span>
                        <Button variant="ghost" size="sm" className="text-xs" onClick={clearFilters}>Clear filters</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedSessions.map((session) => {
                  const DeviceIcon = getDeviceIcon(session.device);
                  return (
                    <TableRow
                      key={session.session_id}
                      className="group border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setSelectedSession(session.session_id)}
                    >
                      {/* Session identity */}
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/5 rounded-lg group-hover:bg-primary/10 transition-colors shrink-0">
                            <Play className="h-3.5 w-3.5 text-primary opacity-60" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-sm truncate max-w-[220px] group-hover:text-primary transition-colors">
                              {session.entry_page === '/' ? 'Home Page' : val(session.entry_page, 'Unknown page')}
                            </p>
                            <p className="text-[10px] font-mono text-muted-foreground opacity-50">
                              {session.session_id ? session.session_id.slice(0, 12) : ''}…
                            </p>
                          </div>
                        </div>
                      </TableCell>

                      {/* Browser + device */}
                      <TableCell className="py-4 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="flex items-center gap-1.5 font-bold text-xs">
                            <DeviceIcon className="h-3.5 w-3.5 text-muted-foreground/70" />
                            <span className={val(session.browser) === '—' ? 'text-muted-foreground/40' : ''}>{val(session.browser)}</span>
                          </div>
                          <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-tighter">
                            {val(session.device, 'Desktop')}
                          </Badge>
                        </div>
                      </TableCell>

                      {/* OS */}
                      <TableCell className="py-4 text-center">
                        <span className={`text-xs font-medium ${val(session.os) === '—' ? 'text-muted-foreground/30' : 'text-muted-foreground'}`}>{val(session.os)}</span>
                      </TableCell>

                      {/* Country */}
                      <TableCell className="py-4 text-center">
                        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-bold text-[10px] uppercase ${val(session.country) === '—' ? 'text-muted-foreground/30' : 'bg-muted'}`}>
                          <Globe className="h-3 w-3 text-muted-foreground" />
                          {val(session.country)}
                        </div>
                      </TableCell>

                      {/* Duration */}
                      <TableCell className="py-4 text-center">
                        <span className="font-bold text-sm tabular-nums">{formatDuration(session.duration_seconds)}</span>
                      </TableCell>

                      {/* Steps/chunks */}
                      <TableCell className="py-4 text-center">
                        <span className="text-sm font-bold tabular-nums">{session.chunk_count}</span>
                      </TableCell>

                      {/* Captured time */}
                      <TableCell className="px-6 py-4">
                        <span className="text-[11px] font-medium text-muted-foreground/80">
                          {(() => {
                            try {
                              const date = new Date(session.start_time);
                              if (!session.start_time || isNaN(date.getTime())) return 'Just now';
                              return formatDistanceToNow(date, { addSuffix: true });
                            } catch { return 'Just now'; }
                          })()}
                        </span>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost" size="icon"
                                  className="h-8 w-8 rounded-md hover:bg-destructive/10 hover:text-destructive transition-all"
                                  onClick={() => handleDelete(session.session_id)}
                                  disabled={deleting === session.session_id}
                                >
                                  {deleting === session.session_id
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <Trash2 className="h-3.5 w-3.5" />}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete recording</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-all group-hover:translate-x-0.5" />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between bg-muted/5 gap-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-60">
              {filteredSessions.length === 0
                ? 'No results'
                : `Showing ${(currentPage - 1) * itemsPerPage + 1}–${Math.min(currentPage * itemsPerPage, filteredSessions.length)} of ${filteredSessions.length} sessions`}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {paginationRange.map((item, idx) =>
                  item === '...' ? (
                    <span key={`e-${idx}`} className="h-8 w-8 flex items-center justify-center text-xs text-muted-foreground select-none">…</span>
                  ) : (
                    <Button
                      key={item}
                      variant={currentPage === item ? "default" : "outline"}
                      size="icon"
                      className={cn("h-8 w-8 text-xs font-bold", currentPage === item && "bg-primary text-primary-foreground")}
                      onClick={() => setCurrentPage(item as number)}
                    >
                      {item}
                    </Button>
                  )
                )}
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
