'use client';

import { usePathSegment } from '@/lib/path-segment';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useAppNavigation } from '@/lib/embed-nav';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePermissions } from '@/hooks/use-permissions';
import {
  COLLECTION_SURFACE, CollectionEmpty, CollectionPager, CollectionSkeleton, CountTabs, FilterToolbar, LayoutSwitch, useLayoutPreference, type FilterField,
} from '@/components/ui/collection';
import { GHOST_BUTTON, LIST_PAGE, PageBar } from '@/components/ui/linear-list';
import { Video, RefreshCw, Trash2 } from 'lucide-react';

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
import { useT } from '@/lib/i18n';

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

type View = 'all' | 'look' | 'errors' | 'rage' | 'mobile';
const VIEWS: View[] = ['all', 'look', 'errors', 'rage', 'mobile'];

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
  const messages = useT();
  const m = messages.replays;
  const t = m.list;

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
  // Table first: the sessions side by side, with checkboxes for acting on several at once.
  const [layout, setLayout] = useLayoutPreference<ReplayLayout>('replays', LAYOUTS, 'table');
  /** Sessions ticked in the table, by id. */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /** Rolling window in days; 0 is every retained session. */
  const [rangeDays, setRangeDays] = useState<number>(DEFAULT_REPLAY_DAYS);
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setCommittedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  /** What a view narrows to, on top of the search, range and filters every view shares. */
  const filtersFor = useCallback((v: View): ReplayListParams => {
    const dev = v === 'mobile' ? 'mobile' : deviceFilter;
    return {
      search: committedSearch || undefined,
      device: dev === 'all' ? undefined : dev,
      days: rangeDays || undefined,
      sort: sort === 'frustration' ? 'frustration' : undefined,
      group: groupFilter ?? undefined,
      minFrustration: v === 'look' ? FRUSTRATED_MIN_SCORE : undefined,
      hasErrors: v === 'errors' || undefined,
      hasRageClicks: v === 'rage' || undefined,
    };
  }, [committedSearch, deviceFilter, rangeDays, sort, groupFilter]);
  const filters = useMemo(() => filtersFor(view), [filtersFor, view]);

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
        title: isDemoMode ? t.simulated : t.deleted,
        description: isDemoMode ? t.simulatedBody : t.deletedBody,
      });
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: t.deleteFailed,
        description: err.message || t.deleteFailedBody,
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
  const demoIn = useCallback((v: View) => {
    const q = committedSearch.toLowerCase();
    const dev = v === 'mobile' ? 'mobile' : deviceFilter;
    return rows
      .filter((r) => v !== 'look' || sessionLevel(r) === 'look')
      .filter((r) => v !== 'errors' || r.has_errors)
      .filter((r) => v !== 'rage' || r.has_rage_clicks)
      .filter((r) => dev === 'all' || r.device.toLowerCase() === dev)
      .filter((r) => !groupFilter || inSessionGroup(r, groupFilter))
      .filter((r) => !q || [r.country, r.browser, r.entry_page, r.summary ?? ''].some((x) => x.toLowerCase().includes(q)));
  }, [rows, committedSearch, deviceFilter, groupFilter]);
  const demoMatching = useMemo(() => {
    if (!isDemoMode) return [];
    const kept = demoIn(view);
    return sort === 'frustration' ? [...kept].sort((a, b) => importance(b) - importance(a)) : kept;
  }, [isDemoMode, demoIn, view, sort]);

  /**
   * Each tab's count: the same search, range and filters, narrowed the tab's way. One row per
   * request, read for its total; the open tab's count is the list's own.
   */
  const countQueries = useQueries({
    queries: VIEWS.map((v) => ({
      queryKey: ['sessions', websiteId, 'count', filtersFor(v)],
      queryFn: () => listSessions(websiteId, { ...filtersFor(v), limit: 1, offset: 0 }),
      enabled: !isDemoMode && !!websiteId && v !== view,
      staleTime: 60 * 1000,
    })),
  });

  const pageRows = isDemoMode ? demoMatching.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE) : rows;
  const totalRows = isDemoMode ? demoMatching.length : (apiData?.total ?? 0);
  const countOf = (v: View, i: number): number | undefined => {
    if (isDemoMode) return demoIn(v).length;
    if (v === view) return apiData ? totalRows : undefined;
    return countQueries[i]?.data?.total;
  };
  const filtersActive = Boolean(committedSearch) || deviceFilter !== 'all' || groupFilter !== null || view !== 'all';

  const clearFilters = useCallback(() => {
    setSearch('');
    setCommittedSearch('');
    setDeviceFilter('all');
    setGroupFilter(null);
    setView('all');
  }, []);

  const play = useCallback((sessionId: string) => router.push(`/websites/${websiteId}/replays/${sessionId}`), [router, websiteId]);
  /** The ticked sessions still on this page: a tab, search or page turn that hides one leaves it out. */
  const chosen = [...selected].filter((id) => pageRows.some((r) => r.session_id === id));
  const removeChosen = async () => {
    const ok = await confirm({
      title: t.deleteManyTitle(chosen.length),
      description: t.deleteManyBody,
      confirmLabel: t.deleteManyConfirm,
      destructive: true,
    });
    if (ok) deleteMutation.mutate(chosen, { onSuccess: () => setSelected(new Set()) });
  };
  const readOnly = embed || !canEdit;
  const remove = useCallback(async (sessionId: string) => {
    const ok = await confirm({
      title: t.deleteTitle,
      description: t.deleteBody,
      confirmLabel: t.deleteConfirm,
      destructive: true,
    });
    if (ok) deleteMutation.mutate([sessionId]);
  }, [confirm, deleteMutation, t]);

  const fields: FilterField[] = [
    {
      // The Mobile tab narrows by device itself, so it shows no chip here; picking a device leaves that tab.
      id: 'device', label: t.device, value: deviceFilter === 'all' ? '' : deviceFilter,
      onChange: (v) => { setDeviceFilter((v || 'all') as DeviceFilter); if (view === 'mobile') setView('all'); },
      options: DEVICES.map((d) => ({ value: d, label: m.devices[d] })),
    },
    {
      id: 'visit', label: t.visit, value: groupFilter ?? '',
      onChange: (v) => setGroupFilter((v || null) as SessionGroup | null),
      options: SESSION_GROUP_META.map((g) => ({ value: g.id, label: m.sessionGroups[g.id] })),
    },
  ];

  const tabLabels: Record<View, string> = { all: t.tabAll, look: t.tabLook, errors: t.tabErrors, rage: t.tabRage, mobile: t.tabMobile };
  /** The panel's top row: the views with their counts on the left, every control on the right. */
  const toolbar = (
    <FilterToolbar
      leading={
        <CountTabs
          label={t.views}
          tabs={VIEWS.map((v, i) => ({ id: v, label: tabLabels[v], count: countOf(v, i) }))}
          value={view}
          onChange={setView}
        />
      }
      sort={{
        value: sort, onChange: (v) => setSort(v as SessionSort),
        options: [{ value: 'frustration', label: t.sortImportant }, { value: 'recent', label: t.sortNewest }],
      }}
      filters={fields}
      search={{ value: search, onChange: setSearch, placeholder: t.searchPlaceholder, label: t.searchLabel }}
    >
      <LayoutSwitch layouts={LAYOUTS} value={layout} onChange={setLayout} />
    </FilterToolbar>
  );
  /** Under the toolbar while sessions are ticked: how many, clear, delete. */
  const bulkBar = chosen.length > 0 && layout === 'table' && !readOnly ? (
    <div className="flex items-center gap-2 border-b border-border/70 bg-muted/60 px-4 py-1.5 text-[13px]">
      <span className="font-medium text-foreground">{t.selected(chosen.length)}</span>
      <button type="button" className={GHOST_BUTTON} onClick={() => setSelected(new Set())}>{messages.actions.clear}</button>
      <button type="button" className={cn(GHOST_BUTTON, 'gap-1.5 text-destructive hover:text-destructive')} disabled={deleteMutation.isPending} onClick={removeChosen}>
        <Trash2 className="size-3.5" />{messages.actions.delete}
      </button>
    </div>
  ) : null;

  return (
    <div className={LIST_PAGE}>
      {confirmDialog}

      <PageBar themeToggle={!embed} title={t.title} description={t.description}>
        <ReplayRangeSelect value={rangeDays} onChange={setRangeDays} />
        {!isDemoMode && (
          <button type="button" className={GHOST_BUTTON} onClick={() => refetch()} aria-label={messages.actions.refresh}>
            <RefreshCw className={cn('size-3.5', isFetching && 'animate-spin')} />
          </button>
        )}
      </PageBar>

      {isLoading && !isDemoMode ? <div className={COLLECTION_SURFACE}>{toolbar}<CollectionSkeleton rows={10} /></div> : pageRows.length === 0 ? (
        <div className={COLLECTION_SURFACE}>{toolbar}<CollectionEmpty
          icon={<Video />}
          title={filtersActive ? t.emptyFilteredTitle : t.emptyTitle}
          description={filtersActive
            ? t.emptyFiltered
            : isDemoMode
              ? t.emptyDemo
              : t.emptyBody}
          action={filtersActive ? <button type="button" className={cn(GHOST_BUTTON, 'border border-border')} onClick={clearFilters}>{t.clearFilters}</button> : undefined}
        /></div>
      ) : layout === 'table' ? (
        <SessionTable
          rows={pageRows} websiteId={websiteId} sort={sort} onPlay={play} onDelete={readOnly ? undefined : remove}
          toolbar={<>{toolbar}{bulkBar}</>}
          selection={readOnly ? undefined : {
            selected,
            labelOf: (id) => pageRows.find((r) => r.session_id === id)?.entry_page ?? id,
            onChange: (ids, on) => setSelected((prev) => { const next = new Set(prev); ids.forEach((id) => (on ? next.add(id) : next.delete(id))); return next; }),
          }}
        />
      ) : (
        // Grouped by importance only when that is the order; newest first reads as one timeline.
        <SessionList rows={pageRows} websiteId={websiteId} grouped={sort === 'frustration'} onPlay={play} onDelete={readOnly ? undefined : remove} toolbar={toolbar} />
      )}

      <CollectionPager page={pageIndex} pageSize={PAGE_SIZE} total={totalRows} onChange={setPageIndex} previousLabel={t.newer} nextLabel={t.older} />
    </div>
  );
}
