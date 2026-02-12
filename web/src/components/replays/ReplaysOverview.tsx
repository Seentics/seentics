'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Loader2, 
  Play, 
  Users, 
  Clock, 
  Globe, 
  Laptop, 
  Trash2, 
  Monitor, 
  Smartphone,
  Tablet,
  ArrowLeft,
  Settings,
  ChevronLeft,
  ChevronRight,
  Activity,
  Search,
  Filter,
  RefreshCw,
  PlayCircle
} from 'lucide-react';
import { cn } from "@/lib/utils";
import Link from 'next/link';
import { Input } from "@/components/ui/input";
import { formatDistanceToNow } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
          <div className={`p-2 rounded ${colorClasses[color]}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <CardTitle className="text-2xl font-black text-slate-900 dark:text-white mt-2">
          {value}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-bold text-muted-foreground">{description}</p>
        </div>
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
  const [searchQuery, setSearchQuery] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/replays/sessions?website_id=${websiteId}`);
      setSessions(response.data.sessions || []);
      setLoading(false);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Failed to fetch sessions');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [websiteId]);

  const stats = useMemo(() => {
    if (sessions.length === 0) return { total: 0, avgDuration: '0s', topEnv: 'N/A' };
    
    const total = sessions.length;
    const avgSeconds = sessions.reduce((acc, s) => acc + s.duration_seconds, 0) / total;
    
    // Most common browser
    const browsers: Record<string, number> = {};
    sessions.forEach(s => {
      browsers[s.browser] = (browsers[s.browser] || 0) + 1;
    });
    const topBrowser = Object.entries(browsers).sort((a, b) => b[1] - a[1])[0][0];

    return {
      total,
      avgDuration: avgSeconds > 60 
          ? `${Math.round(avgSeconds / 60)}m ${Math.round(avgSeconds % 60)}s` 
          : `${Math.round(avgSeconds)}s`,
      topEnv: topBrowser
    };
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    if (!searchQuery) return sessions;
    const query = searchQuery.toLowerCase();
    return sessions.filter(s => 
      s.entry_page?.toLowerCase().includes(query) || 
      s.session_id?.toLowerCase().includes(query) ||
      s.browser?.toLowerCase().includes(query) ||
      s.country?.toLowerCase().includes(query)
    );
  }, [sessions, searchQuery]);

  const paginatedSessions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredSessions.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredSessions, currentPage]);

  const totalPages = Math.ceil(filteredSessions.length / itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handleDelete = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this recording?')) return;

    try {
      setDeleting(sessionId);
      await api.delete(`/replays/sessions/${sessionId}?website_id=${websiteId}`);
      setSessions(sessions.filter(s => s.session_id !== sessionId));
      setDeleting(null);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to delete recording');
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

  if (selectedSession) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
             <Button 
              variant="outline" 
              onClick={() => setSelectedSession(null)}
              className="group border font-bold px-4 rounded-lg h-9 text-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-2 group-hover:-translate-x-0.5 transition-transform" />
              Back to Overview
            </Button>
            <div className="h-4 w-px bg-border"></div>
             <h3 className="font-bold tracking-tight text-lg opacity-90">Replaying Session: <span className="text-primary">{selectedSession.slice(0, 8)}</span></h3>
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
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
            <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              Session Recordings
            </h2>
            <p className="text-muted-foreground font-medium tracking-tight text-sm">
              Watch how users interact with your site to identify points of friction and opportunity.
            </p>
        </div>
        <div className="flex items-center gap-3">
            <Link href={`/websites/${websiteId}/settings?tab=replays`}>
                <Button 
                    variant="outline"
                    className="rounded-lg font-bold px-4 h-10 border border-primary/10 hover:border-primary/30 transition-all bg-primary/5 hover:bg-primary/10 text-primary text-sm"
                >
                    <Settings className="h-4 w-4 mr-2" />
                    Configure
                </Button>
            </Link>
            <Button 
                className="rounded-lg font-black px-4 h-10 border border-primary/20 hover:border-primary/50 transition-all bg-primary/5 hover:bg-primary/10 text-primary text-[10px] uppercase tracking-widest"
                variant="outline"
                onClick={fetchSessions}
            >
                <RefreshCw className={cn("h-3.5 w-3.5 mr-2", loading && "animate-spin")} />
                Refresh Data
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
        <div className="md:col-span-3 relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <Input 
            placeholder="Search by page, ID, browser or country..." 
            className="pl-10 bg-muted/20 border-border/40 h-10 font-medium text-xs focus-visible:ring-primary/20 transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 text-right pr-2">
          {filteredSessions.length} of {sessions.length} matches
        </div>
      </div>

      {/* Summary Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard 
            title="Total Captures" 
            value={stats.total} 
            icon={PlayCircle} 
            description="Stored interactions" 
            color="primary"
        />
        <StatsCard 
            title="Average Retention" 
            value={stats.avgDuration} 
            icon={Clock} 
            description="Mean session length" 
            color="blue"
        />
        <StatsCard 
            title="Dominant Stack" 
            value={stats.topEnv} 
            icon={Laptop} 
            description="Leading system" 
            color="purple"
        />
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
        <div className="space-y-4">
          <Card className="bg-card/50 border-border/40 overflow-hidden shadow-sm shadow-black/5">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent border-border/40">
                    <TableHead className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap">Session origin</TableHead>
                    <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center whitespace-nowrap">Platform</TableHead>
                    <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center whitespace-nowrap">Location</TableHead>
                    <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center whitespace-nowrap">Duration</TableHead>
                    <TableHead className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right whitespace-nowrap">Captured</TableHead>
                    <TableHead className="w-[100px] px-6 py-4"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedSessions.map((session) => {
                    const DeviceIcon = getDeviceIcon(session.device);
                    return (
                      <TableRow 
                        key={session.session_id} 
                        className="group border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => setSelectedSession(session.session_id)}
                      >
                        <TableCell className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/5 rounded-lg group-hover:bg-primary/10 transition-colors">
                                <Play className="h-3.5 w-3.5 text-primary opacity-60" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-sm truncate max-w-[250px] group-hover:text-primary transition-colors">
                                {session.entry_page === '/' ? 'Home Page' : session.entry_page}
                              </p>
                              <p className="text-[10px] font-medium text-muted-foreground opacity-60">
                                {session.session_id ? session.session_id.slice(0, 8) : 'Unknown'}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-4 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                             <div className="flex items-center gap-1.5 font-bold text-xs">
                               <DeviceIcon className="h-3.5 w-3.5 text-muted-foreground/70" />
                               <span>{session.browser}</span>
                             </div>
                             <span className="text-[10px] font-medium text-muted-foreground/60 uppercase">
                               {session.os}
                             </span>
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-4 text-center">
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-muted rounded-md font-bold text-[10px] uppercase">
                            <Globe className="h-3 w-3 text-muted-foreground" />
                            {session.country || 'Unknown'}
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-4 text-center">
                          <div className="font-bold text-sm flex flex-col items-center">
                            <span>{Math.round(session.duration_seconds)}s</span>
                            <span className="text-[10px] font-medium text-muted-foreground/40 uppercase">
                              {session.chunk_count} steps
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-4 text-right">
                          <span className="text-[11px] font-medium text-muted-foreground/80">
                            {(() => {
                                try {
                                  const date = new Date(session.start_time);
                                  if (!session.start_time || isNaN(date.getTime())) return 'Just now';
                                  return formatDistanceToNow(date, { addSuffix: true });
                                } catch (e) {
                                  return 'Just now';
                                }
                            })()}
                          </span>
                        </TableCell>
                        <TableCell className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 rounded-md hover:bg-destructive/10 hover:text-destructive transition-all"
                                onClick={() => handleDelete(session.session_id)}
                                disabled={deleting === session.session_id}
                            >
                                {deleting === session.session_id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                )}
                            </Button>
                            <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-all group-hover:translate-x-0.5" />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Control */}
            {filteredSessions.length > 0 && (
              <div className="p-6 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between bg-muted/5 gap-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-50">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredSessions.length)} of {filteredSessions.length} sessions
                </p>
                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => p - 1)}
                      className="h-8 px-4 font-bold text-[10px] uppercase tracking-wider"
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {[...Array(totalPages)].map((_, i) => (
                        <Button
                          key={i}
                          variant={currentPage === i + 1 ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(i + 1)}
                          className={cn(
                            "h-8 w-8 p-0 font-bold text-xs shadow-sm",
                            currentPage === i + 1 && "bg-primary text-white"
                          )}
                        >
                          {i + 1}
                        </Button>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(p => p + 1)}
                      className="h-8 px-4 font-bold text-[10px] uppercase tracking-wider"
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
