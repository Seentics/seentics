'use client';

import { usePathSegment } from '@/lib/path-segment';

import { useMemo, useState, useCallback } from 'react';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useAppNavigation } from '@/lib/embed-nav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePermissions } from '@/hooks/use-permissions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Flame, RefreshCw, Trash2 } from 'lucide-react';
import {
  COLLECTION_SURFACE, CollectionEmpty, CollectionSkeleton, CountTabs, FilterToolbar, LayoutSwitch, useLayoutPreference, type FilterField,
} from '@/components/ui/collection';
import { DOT, GHOST_BUTTON, LIST_PAGE, PageBar } from '@/components/ui/linear-list';
import {
  HEATMAP_SIGNAL, HeatmapCards, HeatmapList, HeatmapTable, type HeatmapDevice, type HeatmapListPage,
} from '@/components/heatmaps/HeatmapList';
import type { ThumbMode } from '@/components/heatmaps/HeatmapThumbnail';
import { useToast } from '@/hooks/use-toast';
import { useT } from '@/lib/i18n';

import { isDemo } from '@/lib/demo';
import { demoHeatmapPages } from '@/lib/demo/heatmaps';
import {
  listHeatmapPages,
  deleteHeatmaps,
  heatmapPageSlug,
  type HeatmapPageSummary,
} from '@/lib/heatmaps-api';
import { DEFAULT_HEATMAP_DAYS, HEATMAP_RANGES } from '@/features/heatmaps/api';
import { RangeSelect } from '@/components/ui/range-select';

import { cn } from '@/lib/utils';
import { HEATMAP_TONE_RANK, heatmapTone, pageSignals, type HeatmapGroupId } from '@/features/heatmaps/page-insights';

/** Which pages the list shows. */
type HeatmapView = 'all' | 'attention' | 'healthy';
type HeatmapSort = 'attention' | 'views' | 'dead';

const LAYOUTS = ['list', 'table', 'cards'] as const;
type HeatmapLayout = (typeof LAYOUTS)[number];

/** Each order's tie-breaker is traffic. */
const SORTS: Record<HeatmapSort, { compare: (a: PageRow, b: PageRow) => number }> = {
  attention: {
    compare: (a, b) => HEATMAP_TONE_RANK[heatmapTone(b)] - HEATMAP_TONE_RANK[heatmapTone(a)] || severity(b) - severity(a) || b.views - a.views,
  },
  views: { compare: (a, b) => b.views - a.views },
  dead: { compare: (a, b) => (b.dead_click_pct ?? -1) - (a.dead_click_pct ?? -1) || b.views - a.views },
};

/** Path-only label for table; tooltip keeps full stored path. */
const HEATMAP_PATH_MAX = 56;

/** Drop redundant `/websites/{id}/` when paths are recorded as dashboard routes. */
function stripWebsiteDashboardPrefix(path: string, websiteId: string): string {
  if (!websiteId) return path;
  const prefix = `/websites/${websiteId}`;
  if (path === prefix || path === `${prefix}/`) return '/';
  if (path.startsWith(`${prefix}/`)) return path.slice(prefix.length);
  return path;
}

/**
 * Collapse dynamic-ID path segments to `:id` — same rule as the backend
 * `normalizeHeatmapPagePath`. Handles legacy rows already stored with raw IDs.
 */
const DYNAMIC_SEGMENT_RE =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[a-z]-[a-z0-9]{16,}|[a-z0-9]{24,}|\d{6,})$/i;

function normalizeDynamicIds(path: string): string {
  return path
    .split('/')
    .map((seg) => (DYNAMIC_SEGMENT_RE.test(seg) ? ':id' : seg))
    .join('/');
}

function heatmapPathDisplay(raw: string, websiteId: string): { display: string; title: string } {
  const t = raw?.trim() || '/';
  let path = t;
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t) || t.startsWith('//')) {
      const u = new URL(t.startsWith('//') ? `https:${t}` : t);
      path = `${u.pathname}${u.search}` || '/';
    }
  } catch {
    /* plain path */
  }
  if (!path.startsWith('/')) path = `/${path}`;

  const title = normalizeDynamicIds(stripWebsiteDashboardPrefix(path, websiteId));
  const relative = title;
  const display =
    relative.length <= HEATMAP_PATH_MAX
      ? relative
      : `${relative.slice(0, HEATMAP_PATH_MAX - 1)}…`;
  return { display, title };
}

// Unified row type (merges demo + real data shapes)
interface PageRow {
  url:        string;
  views:      number;
  clicks:     number;
  avg_scroll: number;
  active:     boolean;
  last_seen?: string;
  dead_click_pct?:     number | null;
  reach_half_pct?:     number | null;
  mobile_avg_scroll?:  number | null;
  desktop_avg_scroll?: number | null;
}

export default function HeatmapsPage() {
  return <HeatmapsView />;
}

/**
 * The heatmap pages: the signed-in page, and the same page inside a watch-only embed.
 *
 * Laid out as Linear lists issues: grouped Needs attention / Healthy, the worst problems
 * first, one quiet row per page.
 */
export function HeatmapsView({ websiteId: websiteIdProp, embed = false }: { websiteId?: string; embed?: boolean }) {
  const segment = usePathSegment(1) ?? '';
  const router     = useAppNavigation();
  const websiteId  = websiteIdProp ?? segment;
  const isDemoMode = isDemo(websiteId);
  // Deleting is for members and up; a viewer, like the watch-only embed, only looks.
  const { canEdit } = usePermissions(embed ? '' : websiteId);
  const readOnly = embed || !canEdit;
  const queryClient = useQueryClient();
  const { toast }   = useToast();
  const messages = useT();
  const m = messages.heatmaps;
  const t = m.list;
  const sortLabel: Record<HeatmapSort, string> = { attention: t.sortAttention, views: t.sortViews, dead: t.sortDead };
  const [confirm, confirmDialog] = useConfirm();
  const [search, setSearch] = useState('');
  const [days, setDays] = useState<number>(DEFAULT_HEATMAP_DAYS);

  // The range follows into the page's heatmap, so its counts match the row clicked.
  const heatmapHref = useCallback(
    (pagePath: string) =>
      `/websites/${websiteId}/heatmaps/${heatmapPageSlug(pagePath)}` +
      (days === DEFAULT_HEATMAP_DAYS ? '' : `?days=${days}`),
    [websiteId, days],
  );

  const deleteMutation = useMutation({
    mutationFn: (paths: string[]) => {
      if (isDemoMode) return Promise.resolve();
      return deleteHeatmaps(websiteId, paths);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['heatmap-pages', websiteId] });
      toast({
        title: isDemoMode ? t.simulated : t.deleted,
        description: isDemoMode ? t.simulatedBody : t.deletedBody,
      });
    },
  });


  // Real API
  const { data: apiPages, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey:  ['heatmap-pages', websiteId, days],
    queryFn:   () => listHeatmapPages(websiteId, days),
    // Empty until usePathSegment reads the URL after mount — see the replays list.
    enabled:   !isDemoMode && !!websiteId,
    staleTime: 5 * 60 * 1000,
    gcTime:    15 * 60 * 1000,
  });

  // Normalise data to a common shape
  const pages: PageRow[] = useMemo(() => {
    if (isDemoMode) {
      return demoHeatmapPages().map(p => ({
        url:        p.url,
        views:      p.views,
        clicks:     p.clicks,
        avg_scroll: p.avg_scroll,
        active:     p.active,
        dead_click_pct: p.dead_click_pct,
        reach_half_pct: p.reach_half_pct,
        mobile_avg_scroll: p.mobile_avg_scroll,
        desktop_avg_scroll: p.desktop_avg_scroll,
      }));
    }
    return (apiPages ?? []).map((p: HeatmapPageSummary) => ({
      url:        p.page_path,
      views:      p.click_count + p.scroll_count,
      clicks:     p.click_count,
      avg_scroll: p.avg_scroll,
      active:     true,
      last_seen:  p.last_seen,
      dead_click_pct: p.dead_click_pct,
      reach_half_pct: p.reach_half_pct,
      mobile_avg_scroll: p.mobile_avg_scroll,
      desktop_avg_scroll: p.desktop_avg_scroll,
    }));
  }, [isDemoMode, apiPages]);

  /** Which pages show: every page, the ones needing attention, or the healthy ones. */
  const [view, setView] = useState<HeatmapView>('all');
  /** Whose scroll the figures and previews show. */
  const [device, setDevice] = useState<HeatmapDevice>('desktop');
  const [sort, setSort] = useState<HeatmapSort>('attention');
  const [signal, setSignal] = useState<HeatmapGroupId | ''>('');
  /** What the cards draw on each page: where people click, or how far they scroll. */
  const [mode, setMode] = useState<ThumbMode>('clicks');
  // Table first: every figure side by side, with checkboxes for acting on several pages at once.
  const [layout, setLayout] = useLayoutPreference<HeatmapLayout>('heatmaps', LAYOUTS, 'table');
  /** Pages ticked in the table, by URL. */
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const ordered = useMemo(() => [...pages].sort(SORTS[sort].compare), [pages, sort]);

  /** The pages the search and Signal filter keep, before the tab narrows them. */
  const matching = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ordered
      // A page matches when it has the signal at all, not only as its first.
      .filter((p) => !signal || pageSignals(p).includes(signal))
      .filter((p) => !q || p.url.toLowerCase().includes(q));
  }, [ordered, signal, search]);
  const inView = useCallback((p: PageRow, v: HeatmapView) => v === 'all' || (v === 'attention') === (heatmapTone(p) === 'problem'), []);

  const shown: HeatmapListPage[] = useMemo(() => matching
    .filter((p) => inView(p, view))
    .map((p) => {
      const { display, title } = heatmapPathDisplay(p.url, websiteId);
      return { ...p, path: display, title };
    }), [matching, inView, view, websiteId]);

  const filters: FilterField[] = [{
    id: 'signal', label: t.signal, value: signal, onChange: (v) => setSignal(v as HeatmapGroupId | ''),
    options: (Object.keys(HEATMAP_SIGNAL) as HeatmapGroupId[]).map((id) => ({
      value: id, label: m.signals[id],
      icon: <span aria-hidden className="size-1.5 rounded-full" style={{ background: DOT[HEATMAP_SIGNAL[id].tone] }} />,
    })),
  }];

  const remove = async (url: string) => {
    const ok = await confirm({
      title: t.deleteTitle,
      description: t.deleteBody(url),
      confirmLabel: t.deleteConfirm,
      destructive: true,
    });
    if (ok) deleteMutation.mutate([url]);
  };

  const open = (url: string) => router.push(heatmapHref(url));
  /** The ticked pages still shown: a tab or search that hides one leaves it out. */
  const chosen = [...selected].filter((url) => shown.some((p) => p.url === url));
  const removeChosen = async () => {
    const ok = await confirm({
      title: t.deleteManyTitle(chosen.length),
      description: t.deleteManyBody,
      confirmLabel: t.deleteConfirm,
      destructive: true,
    });
    if (ok) deleteMutation.mutate(chosen, { onSuccess: () => setSelected(new Set()) });
  };
  const onDelete = readOnly ? undefined : remove;

  const views: { id: HeatmapView; label: string }[] = [{ id: 'all', label: t.tabAll }, { id: 'attention', label: t.tabAttention }, { id: 'healthy', label: t.tabHealthy }];
  /** The panel's top row: the views with their counts on the left, every control on the right. */
  const toolbar = (
    <FilterToolbar
      leading={
        <CountTabs
          label={t.views}
          tabs={views.map((v) => ({ ...v, count: isLoading && !isDemoMode ? undefined : matching.filter((p) => inView(p, v.id)).length }))}
          value={view}
          onChange={setView}
        />
      }
      sort={{
        value: sort, onChange: (v) => setSort(v as HeatmapSort),
        options: (Object.keys(SORTS) as HeatmapSort[]).map((id) => ({ value: id, label: sortLabel[id] })),
      }}
      filters={filters}
      search={{ value: search, onChange: setSearch, placeholder: t.searchPlaceholder, label: t.searchLabel }}
    >
      {layout === 'cards' && (
        <Toggle label={t.overlay} value={mode} onChange={setMode} options={[['clicks', t.clicks], ['scroll', t.scroll]]} />
      )}
      <Toggle label={t.device} value={device} onChange={setDevice} options={[['desktop', m.devices.desktop], ['mobile', m.devices.mobile]]} />
      <LayoutSwitch layouts={LAYOUTS} value={layout} onChange={setLayout} />
    </FilterToolbar>
  );
  /** Under the toolbar while pages are ticked: how many, clear, delete. */
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
        <RangeSelect value={days} onChange={setDays} ranges={HEATMAP_RANGES.map((r) => ({ days: r.days, label: m.ranges[`d${r.days}` as keyof typeof m.ranges] ?? r.label }))} />
        {!isDemoMode && (
          <button type="button" className={GHOST_BUTTON} disabled={isFetching} onClick={() => refetch()} aria-label={messages.actions.refresh}>
            <RefreshCw className={cn('size-3.5', isFetching && 'animate-spin')} />
          </button>
        )}
      </PageBar>

      {isError && !isDemoMode && (
        <Alert variant="destructive" className="m-4 w-auto">
          <AlertDescription className="text-sm">
            {(error as Error)?.message ?? t.loadFailed}
          </AlertDescription>
        </Alert>
      )}

      {isLoading && !isDemoMode ? <div className={COLLECTION_SURFACE}>{toolbar}<CollectionSkeleton /></div> : shown.length === 0 ? (
        <div className={COLLECTION_SURFACE}>{toolbar}<CollectionEmpty
          icon={<Flame />}
          title={pages.length === 0 ? t.emptyTitle : t.emptyFilteredTitle}
          description={pages.length === 0
            ? t.emptyBody
            : t.emptyFiltered}
        /></div>
      ) : layout === 'table' ? (
        <HeatmapTable
          pages={shown} device={device} onOpen={open} onDelete={onDelete} sortedBy={sort}
          toolbar={<>{toolbar}{bulkBar}</>}
          selection={readOnly ? undefined : {
            selected,
            labelOf: (url) => shown.find((p) => p.url === url)?.path ?? url,
            onChange: (urls, on) => setSelected((prev) => { const next = new Set(prev); urls.forEach((u) => (on ? next.add(u) : next.delete(u))); return next; }),
          }}
        />
      ) : layout === 'cards' ? (
        <HeatmapCards pages={shown} device={device} onOpen={open} onDelete={onDelete} websiteId={websiteId} days={days} demo={isDemoMode} mode={mode} toolbar={toolbar} />
      ) : (
        <HeatmapList pages={shown} device={device} onOpen={open} onDelete={onDelete} toolbar={toolbar} />
      )}
    </div>
  );
}

/** A two-way switch for the toolbar: Desktop / Mobile, Clicks / Scroll. */
function Toggle<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div role="group" aria-label={label} className="flex gap-0.5 rounded-[7px] border border-border p-0.5">
      {options.map(([id, text]) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className={cn('h-[22px] rounded-[5px] px-2 text-xs font-medium transition-colors', value === id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground')}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/**
 * How bad a page's problems are, to order the pages needing attention: points of dead
 * clicks over the line, points of reach under it, and half the mobile gap.
 */
function severity(p: PageRow): number {
  const dead = p.dead_click_pct ?? 0;
  const reach = p.reach_half_pct ?? 100;
  const gap = (p.desktop_avg_scroll ?? 0) - (p.mobile_avg_scroll ?? 0);
  return (dead >= 20 ? dead : 0) + (reach < 50 ? 50 - reach : 0) + (gap >= 20 ? gap / 2 : 0);
}
