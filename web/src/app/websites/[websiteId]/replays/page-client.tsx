'use client';

import { usePathSegment } from '@/lib/path-segment';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useAppNavigation } from '@/lib/embed-nav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePermissions } from '@/hooks/use-permissions';
import {
  CollectionEmpty, CollectionPager, CollectionSkeleton, FilterToolbar, LayoutSwitch, useLayoutPreference, type FilterField,
} from '@/components/ui/collection';
import { GHOST_BUTTON, LIST_PAGE, PageBar, ViewTabs } from '@/components/ui/linear-list';
import { Video, RefreshCw } from 'lucide-react';

import { isDemo } from '@/lib/demo';
import { demoReplays } from '@/lib/demo/replays';
import { demoDate } from '@/lib/demo/fixture-utils';
import { DEFAULT_REPLAY_DAYS, ReplayRangeSelect } from '@/components/replays/ReplayRangeSelect';
import { cn } from '@/lib/utils';
import {
  listSessions,
  deleteSessions,
  type ReplayListParams,
  type ReplaySession,
} from '@/lib/replays-api';
import { useToast } from '@/hooks/use-toast';

import { SessionList, SessionTable } from '@/components/replays/SessionList';
import {
  SEARCH_DEBOUNCE_MS,
  type DeviceFilter, type SessionRow, type SessionSort,
} from '@/features/replays/list-types';
import { FRUSTRATED_MIN_SCORE } from '@/features/replays/analysis';
import { sessionLevel } from '@/features/replays/session-line';
import { demoSessionFrustration } from '@/lib/demo/ai';
import { SESSION_GROUP_META, inSessionGroup } from '@/features/replays/groups';
import type { SessionGroup } from '@/features/replays/types';

type View = 'all' | 'look' | 'mobile';

const PAGE_SIZE = 50;

const LAYOUTS = ['list', 'table'] as const;
type ReplayLayout = (typeof LAYOUTS)[number];
const DEVICES = ['desktop', 'mobile', 'tablet'] as const;

/**
 * How much a session needs a look, for the demo's sort: errors and rage clicks first, then
 * the frustration score, unanalysed sessions last — the order core's `frustration` sort gives.
 */
function importance(r: SessionRow): number {
  return (r.has_errors || r.has_rage_clicks ? 1000 : 0) + (r.frustration_score ?? -1);
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function ReplaysPage() {
  return <ReplaysView />;
}

/**
 * The recordings list: the signed-in page, and the same page inside an embed. An embed is
 * watch-only — no deleting — and takes the website from its link, not the URL.
 *
 * Laid out as Linear lists issues: grouped under Needs a look / Worth watching / Smooth,
 * one quiet line per session, the ones that most need a look first.
 */
export function ReplaysView({ websiteId: websiteIdProp, embed = false }: { websiteId?: string; embed?: boolean }) {
  const segment = usePathSegment(1) ?? '';
  const router = useAppNavigation();
  const websiteId = websiteIdProp ?? segment;
  const isDemoMode = isDemo(websiteId);
  // Deleting a recording is for members and up; a viewer, like the watch-only embed, only looks.
  const { canEdit } = usePermissions(embed ? '' : websiteId);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [confirm, confirmDialog] = useConfirm();
  /** What the server is actually filtering on; trails `search` by the debounce. */
  const [committedSearch, setCommittedSearch] = useState('');
  const [view, setView] = useState<View>('all');
  const [deviceFilter, setDeviceFilter] = useState<DeviceFilter>('all');
  /** A kind of visit picked in the Filter menu. */
  const [groupFilter, setGroupFilter] = useState<SessionGroup | null>(null);
  /** Most important first by default: the sessions worth watching lead the list. */
  const [sort, setSort] = useState<SessionSort>('frustration');
  const [layout, setLayout] = useLayoutPreference<ReplayLayout>('replays', LAYOUTS, 'list');
  /** Rolling window in days; 0 is every retained session. */
  const [rangeDays, setRangeDays] = useState<number>(DEFAULT_REPLAY_DAYS);
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setCommittedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  /** The Mobile view is the device filter, kept in one place. */
  const device: DeviceFilter = view === 'mobile' ? 'mobile' : deviceFilter;

  const filters: ReplayListParams = useMemo(() => ({
    search: committedSearch || undefined,
    device: device === 'all' ? undefined : device,
    days: rangeDays || undefined,
    sort: sort === 'frustration' ? 'frustration' : undefined,
    group: groupFilter ?? undefined,
    minFrustration: view === 'look' ? FRUSTRATED_MIN_SCORE : undefined,
  }), [committedSearch, device, rangeDays, sort, groupFilter, view]);

  /** Narrowing the set changes what page 1 means, so never keep the old offset. */
  useEffect(() => {
    setPageIndex(0);
  }, [filters]);

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
        title: isDemoMode ? "Action simulated" : "Session deleted",
        description: isDemoMode
          ? "In demo mode, sessions are not actually deleted."
          : "The recording has been removed.",
      });
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "Deletion failed",
        description: err.message || "Something went wrong while deleting the session.",
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
    queryKey: ['sessions', websiteId, pageIndex, PAGE_SIZE, filters],
    queryFn: () => listSessions(websiteId, {
      ...filters,
      limit: PAGE_SIZE,
      offset: pageIndex * PAGE_SIZE,
    }),
    // The id comes from the URL after mount (usePathSegment); until then it is empty and
    // the request went out as /replays/?limit=… — a 404 on every visit.
    enabled: !isDemoMode && !!websiteId,
    // Keeps the previous page on screen while the next one loads, instead of flashing
    // the empty state between pages.
    placeholderData: (prev) => prev,
    staleTime: 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  // Normalise to common row shape. These are the rows of the CURRENT page only.
  const rows: SessionRow[] = useMemo(() => {
    if (isDemoMode) {
      // The fixtures are anchored to a fixed reference date, so the window is measured
      // from that anchor rather than from the real clock — otherwise any range would be empty.
      const since = rangeDays ? demoDate().getTime() - rangeDays * 86_400_000 : -Infinity;
      return demoReplays().sessions
        .filter(s => new Date(s.start_time).getTime() >= since)
        .map((s, i) => ({
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
        // A spread of scores, so the demo's groups have something in each.
        frustration_score: demoSessionFrustration(i).frustrationScore,
        signal_counts: demoSessionFrustration(i).signalCounts,
        summary: demoSessionFrustration(i).summary,
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
      frustration_score: s.frustrationScore ?? null,
      signal_counts: s.signalCounts ?? null,
      summary: s.summary ?? null,
    }));

  }, [isDemoMode, apiData, rangeDays]);

  /** The demo has no server to filter, sort or page, so it does all three here. */
  const demoMatching = useMemo(() => {
    if (!isDemoMode) return [];
    const q = committedSearch.toLowerCase();
    const kept = rows
      .filter((r) => view !== 'look' || sessionLevel(r) === 'look')
      .filter((r) => device === 'all' || r.device.toLowerCase() === device)
      .filter((r) => !groupFilter || inSessionGroup(r, groupFilter))
      .filter((r) => !q || [r.country, r.browser, r.entry_page, r.summary ?? ''].some((v) => v.toLowerCase().includes(q)));
    return sort === 'frustration' ? [...kept].sort((a, b) => importance(b) - importance(a)) : kept;
  }, [isDemoMode, rows, view, device, groupFilter, committedSearch, sort]);

  const pageRows = isDemoMode ? demoMatching.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE) : rows;
  const totalRows = isDemoMode ? demoMatching.length : (apiData?.total ?? 0);
  const filtersActive = Boolean(committedSearch) || deviceFilter !== 'all' || groupFilter !== null || view !== 'all';

  const clearFilters = useCallback(() => {
    setSearch('');
    setCommittedSearch('');
    setDeviceFilter('all');
    setGroupFilter(null);
    setView('all');
  }, []);

  const play = useCallback((sessionId: string) => router.push(`/websites/${websiteId}/replays/${sessionId}`), [router, websiteId]);
  const readOnly = embed || !canEdit;
  const remove = useCallback(async (sessionId: string) => {
    const ok = await confirm({
      title: 'Delete this recording?',
      description: 'The session replay is removed permanently.',
      confirmLabel: 'Delete recording',
      destructive: true,
    });
    if (ok) deleteMutation.mutate([sessionId]);
  }, [confirm, deleteMutation]);

  const fields: FilterField[] = [
    {
      // The Mobile view is this filter, set from the tabs; picking a device here leaves that view.
      id: 'device', label: 'Device', value: device === 'all' ? '' : device,
      onChange: (v) => { setDeviceFilter((v || 'all') as DeviceFilter); if (view === 'mobile') setView('all'); },
      options: DEVICES.map((d) => ({ value: d, label: cap(d) })),
    },
    {
      id: 'visit', label: 'Visit', value: groupFilter ?? '',
      onChange: (v) => setGroupFilter((v || null) as SessionGroup | null),
      options: SESSION_GROUP_META.map((g) => ({ value: g.id, label: g.label })),
    },
  ];

  return (
    <div className={LIST_PAGE}>
      {confirmDialog}

      <PageBar
        themeToggle={!embed}
        icon={<Video />}
        title="Session replays"
        views={
          <ViewTabs
            label="Views"
            tabs={[{ id: 'all', label: 'All sessions' }, { id: 'look', label: 'Needs a look' }, { id: 'mobile', label: 'Mobile' }]}
            value={view}
            onChange={setView}
          />
        }
      >
        <ReplayRangeSelect value={rangeDays} onChange={setRangeDays} />
        {!isDemoMode && (
          <button type="button" className={GHOST_BUTTON} onClick={() => refetch()} aria-label="Refresh">
            <RefreshCw className={cn('size-3.5', isFetching && 'animate-spin')} />
          </button>
        )}
      </PageBar>

      <FilterToolbar
        sort={{
          value: sort, onChange: (v) => setSort(v as SessionSort),
          options: [{ value: 'frustration', label: 'Most important' }, { value: 'recent', label: 'Newest first' }],
        }}
        filters={fields}
        search={{ value: search, onChange: setSearch, placeholder: 'Search country, browser, page…', label: 'Search sessions' }}
        count={`${totalRows.toLocaleString()} ${totalRows === 1 ? 'session' : 'sessions'}`}
      >
        <LayoutSwitch layouts={LAYOUTS} value={layout} onChange={setLayout} />
      </FilterToolbar>

      {isLoading && !isDemoMode ? <CollectionSkeleton rows={10} /> : pageRows.length === 0 ? (
        <CollectionEmpty
          icon={<Video />}
          title={filtersActive ? 'No matching sessions' : 'No sessions yet'}
          description={filtersActive
            ? 'No session matches these filters. The search covers every recorded session, not just this page.'
            : isDemoMode
              ? 'Demo mode has no sessions to show.'
              : 'Install the Seentics tracker with recording enabled to capture sessions.'}
          action={filtersActive ? <button type="button" className={cn(GHOST_BUTTON, 'border border-border')} onClick={clearFilters}>Clear filters</button> : undefined}
        />
      ) : layout === 'table' ? (
        <SessionTable rows={pageRows} websiteId={websiteId} sort={sort} onPlay={play} onDelete={readOnly ? undefined : remove} />
      ) : (
        // Grouped by importance only when that is the order; newest first reads as one timeline.
        <SessionList rows={pageRows} websiteId={websiteId} grouped={sort === 'frustration'} onPlay={play} onDelete={readOnly ? undefined : remove} />
      )}

      <CollectionPager page={pageIndex} pageSize={PAGE_SIZE} total={totalRows} onChange={setPageIndex} previousLabel="Newer" nextLabel="Older" />
    </div>
  );
}
