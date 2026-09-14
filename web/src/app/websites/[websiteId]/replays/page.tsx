'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
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
import { cn } from '@/lib/utils';
import { isDemo } from '@/lib/demo';
import { demoReplays } from '@/lib/demo/replays';
import {
  listSessions,
  deleteSessions,
  type ReplayListParams,
  type ReplaySession,
} from '@/lib/replays-api';
import { useToast } from '@/hooks/use-toast';
import { SessionClientRowStack, SessionCountryVisual } from '@/components/replays/session-environment-visuals';


import { SignalFilter } from '@/components/replays/SignalFilter';
import { sessionColumns } from '@/components/replays/session-columns';
import {
  formatDuration, timeAgo, stripWebsiteDashboardPrefix, entryPathDisplay,
} from '@/features/replays/format';
import {
  PAGE_SIZE_OPTIONS, SEARCH_DEBOUNCE_MS,
  type DeviceFilter, type SessionRow,
} from '@/features/replays/list-types';

export default function ReplaysPage() {
  const params = useParams();
  const router = useRouter();
  const websiteId = params?.websiteId as string;
  const isDemoMode = isDemo(websiteId);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  /** What the server is actually filtering on; trails `search` by the debounce. */
  const [committedSearch, setCommittedSearch] = useState('');
  const [deviceFilter, setDeviceFilter] = useState<DeviceFilter>('all');
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [rageOnly, setRageOnly] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);

  useEffect(() => {
    const t = setTimeout(() => setCommittedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  const filters: ReplayListParams = useMemo(() => ({
    search: committedSearch || undefined,
    device: deviceFilter === 'all' ? undefined : deviceFilter,
    hasErrors: errorsOnly || undefined,
    hasRageClicks: rageOnly || undefined,
  }), [committedSearch, deviceFilter, errorsOnly, rageOnly]);

  /** Narrowing the set changes what page 1 means, so never keep the old offset. */
  useEffect(() => {
    setPageIndex(0);
  }, [filters, pageSize]);

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



  /**
   * One page from the server, filtered by the server.
   *
   * This used to request a fixed 100 rows and do the paging, searching and filtering in
   * the browser. Everything derived from it was therefore a fact about the newest 100
   * sessions while being labelled as a fact about the site — and a search for an older
   * session reported "no results" for a session that exists.
   */
  const { data: apiData, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['sessions', websiteId, pageIndex, pageSize, filters],
    queryFn: () => listSessions(websiteId, {
      ...filters,
      limit: pageSize,
      offset: pageIndex * pageSize,
    }),
    enabled: !isDemoMode,
    // Keeps the previous page on screen while the next one loads, instead of flashing
    // the empty state between pages.
    placeholderData: (prev) => prev,
    staleTime: 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  // Normalise to common row shape. These are the rows of the CURRENT page only.
  const rows: SessionRow[] = useMemo(() => {
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

  /**
   * Headline figures for the whole filtered set, computed by the database.
   *
   * Deriving these from `rows` would make each one a statistic about the page being
   * looked at — "Total Sessions: 25" on a site with thousands. Demo mode has no server
   * to ask, so it sums its own fixture.
   */
  const stats = useMemo(() => {
    if (isDemoMode) {
      const withDuration = rows.filter(r => r.duration_seconds > 0);
      return {
        total: rows.length,
        withErrors: rows.filter(r => r.has_errors).length,
        withRageClicks: rows.filter(r => r.has_rage_clicks).length,
        avgDurationSeconds: withDuration.length
          ? Math.round(withDuration.reduce((a, r) => a + r.duration_seconds, 0) / withDuration.length)
          : 0,
      };
    }
    return apiData?.summary ?? {
      total: apiData?.total ?? 0,
      withErrors: 0,
      withRageClicks: 0,
      avgDurationSeconds: 0,
    };
  }, [isDemoMode, rows, apiData]);

  const totalRows = isDemoMode ? rows.length : (apiData?.total ?? 0);
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));
  const filtersActive = Boolean(committedSearch) || deviceFilter !== 'all' || errorsOnly || rageOnly;

  const clearFilters = useCallback(() => {
    setSearch('');
    setCommittedSearch('');
    setDeviceFilter('all');
    setErrorsOnly(false);
    setRageOnly(false);
  }, []);

  const columns = useMemo(
    () => sessionColumns({
      websiteId,
      onPlay: (sessionId) => router.push(`/websites/${websiteId}/replays/${sessionId}`),
      // The confirm lived inside the column's cell before it was extracted. It belongs
      // here: the column renders a button, the page decides what destroying a session
      // requires.
      onDelete: (sessionId) => {
        if (confirm('Delete this session?')) deleteMutation.mutate([sessionId]);
      },
      isMutating: deleteMutation.isPending,
    }),
    [websiteId, router, deleteMutation],
  );






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
        {
          label: filtersActive ? 'Matching Sessions' : 'Total Sessions',
          value: stats.total,
          icon: Users,
          tone: 'info',
        },
        {
          label: 'Avg Duration',
          value: stats.avgDurationSeconds > 0 ? formatDuration(stats.avgDurationSeconds) : '—',
          icon: Clock,
          tone: 'accent',
        },
        {
          label: 'With Errors',
          value: stats.withErrors,
          icon: AlertTriangle,
          tone: 'danger',
          toneWhen: stats.withErrors > 0,
        },
        {
          label: 'Rage clicks',
          value: stats.withRageClicks,
          icon: MousePointerClick,
          tone: 'warning',
          toneWhen: stats.withRageClicks > 0,
        },
      ]} />

      <DataTable
        className=" shadow-sm rounded-lg overflow-hidden [&_tbody_tr]:transition-colors [&_tbody_td]:align-middle [&_td]:!py-3.5 [&_th]:!py-3.5"
        data={rows}
        columns={columns}
        isLoading={isLoading || isFetching}
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
        toolbarLeft={
          <div>
            <h3 className="text-sm font-semibold text-foreground">Recorded sessions</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {filtersActive
                ? `${stats.total} matching session${stats.total === 1 ? '' : 's'}`
                : `${stats.total} session${stats.total === 1 ? '' : 's'} recorded`}
            </p>
          </div>
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

            {/*
              "Show me the sessions that broke" in one click — the two signals the
              Signals column already surfaces, as filters rather than something to
              scroll for.
            */}
            <SignalFilter
              pressed={errorsOnly}
              onPressedChange={setErrorsOnly}
              label="Errors"
              title="Only sessions where a JavaScript error or unhandled rejection fired"
              icon={<AlertTriangle className="h-3.5 w-3.5" />}
              activeClass="border-red-500/40 bg-red-500/10 text-red-700 hover:bg-red-500/15 dark:text-red-300"
            />
            <SignalFilter
              pressed={rageOnly}
              onPressedChange={setRageOnly}
              label="Rage"
              title="Only sessions with a rage-click cluster"
              icon={<MousePointerClick className="h-3.5 w-3.5" />}
              activeClass="border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 dark:text-amber-300"
            />

            <Select
              value={deviceFilter}
              onValueChange={(v) => setDeviceFilter(v as DeviceFilter)}
            >
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

            {filtersActive && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearFilters}>
                Clear
              </Button>
            )}
          </>
        }
        onRowClick={row => router.push(`/websites/${websiteId}/replays/${row.session_id}`)}
        emptyIcon={<Video className="h-6 w-6" />}
        emptyTitle={filtersActive ? 'No matching sessions' : 'No sessions yet'}
        emptyDescription={
          filtersActive
            ? 'No session matches these filters. The search covers every recorded session, not just this page.'
            : isDemoMode
              ? 'Demo mode has no sessions to show.'
              : 'Install the Seentics tracker with recording enabled to capture sessions.'
        }
        emptyAction={
          filtersActive ? (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : undefined
        }
        paginationMode={isDemoMode ? 'client' : 'server'}
        pageIndex={pageIndex}
        pageSize={pageSize}
        pageCount={pageCount}
        totalRowCount={totalRows}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        onPaginationChange={({ pageIndex: nextIndex, pageSize: nextSize }) => {
          setPageIndex(nextIndex);
          setPageSize(nextSize);
        }}
      />

    </div>
  );
}
