'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
import { cn } from '@/lib/utils';
import { isDemo } from '@/lib/demo';
import { demoReplays } from '@/lib/demo/replays';

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

export default function ReplaysPage() {
  const params = useParams();
  const router = useRouter();
  const websiteId = params?.websiteId as string;
  const isDemoMode = isDemo(websiteId);

  const [search, setSearch] = useState('');
  const [deviceFilter, setDeviceFilter] = useState('all');

  const allSessions = isDemoMode ? demoReplays().sessions : [];

  const filtered = useMemo(() =>
    allSessions.filter(s => {
      if (deviceFilter !== 'all' && s.device.toLowerCase() !== deviceFilter) return false;
      if (search && ![s.country, s.browser, s.entry_page].some(v =>
        v.toLowerCase().includes(search.toLowerCase()))) return false;
      return true;
    }),
    [allSessions, deviceFilter, search]
  );

  const withErrors = allSessions.filter(s => s.has_errors).length;
  const withRage = allSessions.filter(s => s.has_rage_clicks).length;
  const avgDuration = allSessions.length
    ? Math.round(allSessions.reduce((s, r) => s + r.duration_seconds, 0) / allSessions.length)
    : 0;

  const columns: ColumnDef<typeof allSessions[0]>[] = [
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
      size: 80,
      cell: ({ getValue }) => (
        <span className="text-xs text-center block">{getValue() as number}</span>
      ),
    },
    {
      id: 'duration',
      header: ({ column }) => <SortableHeader column={column}>Duration</SortableHeader>,
      accessorKey: 'duration_seconds',
      size: 100,
      cell: ({ getValue }) => (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3 shrink-0" />
          {formatDuration(getValue() as number)}
        </div>
      ),
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
          <Button variant="outline" size="sm" className="h-8 gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        )}
      </DashboardPageHeader>

      <StatCards cards={[
        { label: 'Total Sessions', value: allSessions.length, icon: Users },
        { label: 'Avg Duration',   value: formatDuration(avgDuration), icon: Clock, iconColor: 'text-blue-600', valueColor: 'text-blue-600' },
        { label: 'With Errors',    value: withErrors, icon: AlertTriangle, iconColor: 'text-red-500', valueColor: 'text-red-500' },
        { label: 'Rage Clicks',    value: withRage, icon: AlertTriangle, iconColor: 'text-orange-500', valueColor: 'text-orange-500' },
      ]} />

      <DataTable
        data={filtered}
        columns={columns}
        toolbarLeft={
          <div>
            <h3 className="text-sm font-semibold text-foreground">Step Sessions</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">{filtered.length} session{filtered.length !== 1 ? 's' : ''} recorded</p>
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
        onRowClick={(row) => router.push(`/websites/${websiteId}/replays/${row.id}`)}
        emptyIcon={<Video className="h-6 w-6" />}
        emptyTitle="No sessions yet"
        emptyDescription={isDemoMode ? 'No sessions match your filters.' : 'Install the tracker to start recording sessions.'}
        pageSize={15}
      />
    </div>
  );
}
