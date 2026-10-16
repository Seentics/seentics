'use client';

import { usePathSegment } from '@/lib/path-segment';

import { useMemo, useState, useCallback } from 'react';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useAppNavigation } from '@/lib/embed-nav';
import { useQuery } from '@tanstack/react-query';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { usePermissions } from '@/hooks/use-permissions';
import { AskAiButton } from '@/components/ai/AskAiButton';
import { askAbout } from '@/features/ai/ask-link';
import { DataTable, SortableHeader, ColumnDef, selectionColumn } from '@/components/ui/data-table';

import { StatCards } from '@/components/seentics-ui/StatCards';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Flame,
  Search,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

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
import { getPageIcon } from '@/components/analytics/page-icon';

import { cn } from '@/lib/utils';
import { ListGroups } from '@/components/ui/list-groups';
import { HEATMAP_GROUP_META, HEATMAP_TONE_DOT, HEATMAP_TONE_RANK, heatmapLine, heatmapTone, inHeatmapGroup, type HeatmapGroupId } from '@/features/heatmaps/page-insights';


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
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[a-z]-[a-z0-9]{16 }|[a-z0-9]{24 }|\d{6 })$/i;

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

// Unified row type for table (merges demo + real data shapes)
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

/** The heatmap pages list: the signed-in page, and the same page inside a watch-only embed. */
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
        title: isDemoMode ? "Action simulated" : "Heatmap data deleted",
        description: isDemoMode 
          ? "In demo mode, data is not actually removed."
          : "The selected pages have been cleared.",
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

  /** A group the table is narrowed to, from "Show all" below it. */
  const [groupFilter, setGroupFilter] = useState<HeatmapGroupId | null>(null);

  const filtered = useMemo(
    () => pages.filter(p => !search || p.url.toLowerCase().includes(search.toLowerCase())),
    [pages, search],
  );

  const totalViews  = pages.reduce((s, p) => s + p.views,  0);
  const totalClicks = pages.reduce((s, p) => s + p.clicks, 0);
  const avgScroll   = pages.length
    ? Math.round(pages.reduce((s, p) => s + p.avg_scroll, 0) / pages.length)
    : 0;
  const activePages = pages.filter(p => p.active).length;

  const columns: ColumnDef<PageRow>[] = useMemo(() => [
    ...(readOnly ? [] : [selectionColumn<PageRow>()]),
    {
      id: 'url',

      header: ({ column }) => <SortableHeader column={column}>Page</SortableHeader>,
      accessorKey: 'url',
      cell: ({ row }) => {
        const { display, title } = heatmapPathDisplay(row.original.url, websiteId);
        return (
          <div className="min-w-0 max-w-[min(100%,36rem)]">
            <div className="flex items-center gap-2.5 min-w-0">
              {/* The page's own icon; dimmed when it is not receiving data. */}
              <span
                className={cn('shrink-0', !row.original.active && 'opacity-40 grayscale')}
                title={row.original.active ? 'Receiving data' : 'Inactive'}
              >
                {getPageIcon(row.original.url, 'h-4 w-4')}
              </span>
              <span className="font-mono text-[13px] text-foreground truncate" title={title}>
                {display}
              </span>
            </div>

          </div>
        );
      },
    },
    {
      id: 'what',
      header: 'What happened',
      // Sorts by how much needs attention: problems first, then healthy, then too little data.
      accessorFn: (row) => HEATMAP_TONE_RANK[heatmapTone(row)],
      size: 560,
      cell: ({ row }) => {
        const tone = heatmapTone(row.original);
        const text = heatmapLine(row.original);
        return (
          <div className="flex min-w-0 max-w-[44rem] items-center gap-2">
            <span className={cn('h-2 w-2 shrink-0 rounded-full', HEATMAP_TONE_DOT[tone])} />
            <span className={cn('truncate text-sm', tone === 'problem' ? 'text-foreground' : 'text-muted-foreground')} title={text}>
              {text}
            </span>
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      size: 130,
      cell: ({ row }) => (
        <div className="flex justify-end items-center gap-1 pr-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 bg-primary/10 px-3 text-xs font-semibold text-primary hover:bg-primary/15 hover:text-primary"
            title="Open heatmap"
            onClick={(e) => {
              e.stopPropagation();
              router.push(heatmapHref(row.original.url));
            }}
          >
            <Flame className="h-3.5 w-3.5" />
            View
          </Button>
          {!readOnly && <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
            title="Delete data for this page"
            onClick={async (e) => {
              e.stopPropagation();
              const ok = await confirm({
                title: 'Delete heatmap data for this page?',
                description: `Every click, move and scroll recorded on ${row.original.url} is removed.`,
                confirmLabel: 'Delete data',
                destructive: true,
              });
              if (ok) deleteMutation.mutate([row.original.url]);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>}
        </div>
      ),
    },
  ], [heatmapHref, router, deleteMutation, websiteId, readOnly]);


  return (
    <div className="w-full max-w-[1440px] mx-auto p-4 md:p-5 lg:px-6 lg:py-5">
      {confirmDialog}
      {embed ? null : <DashboardPageHeader
        websiteId={websiteId}
        title="Heatmaps"
        description="See where users click, move, and how far they scroll on each page."
      >
        <AskAiButton websiteId={websiteId} size="md" {...askAbout.heatmaps(days)} />
        {!isDemoMode && (
          <Button
            variant="default"
            size="sm"
            className=" gap-1.5"
            disabled={isFetching}
            onClick={() => refetch()}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
            Refresh
          </Button>
        )}
      </DashboardPageHeader>}

      {isError && !isDemoMode && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription className="text-sm">
            {(error as Error)?.message ?? 'Could not load heatmap pages. Check your connection and try again.'}
          </AlertDescription>
        </Alert>
      )}

      <StatCards cards={[
        { label: 'Total views',      value: totalViews },
        { label: 'Total clicks',     value: totalClicks },
        { label: 'Avg scroll depth', value: avgScroll > 0 ? `${avgScroll}%` : '—' },
        { label: 'Active pages',     value: activePages },
      ]} />

      <DataTable
        className=" shadow-sm rounded-lg overflow-hidden [&_tbody_tr]:transition-colors [&_td]:!py-2 [&_th]:!py-2"
        data={groupFilter ? filtered.filter((p) => inHeatmapGroup(p, groupFilter)) : filtered}
        columns={columns}
        isLoading={isLoading}
        enableRowSelection={!readOnly}
        selectionActions={readOnly ? undefined : (selectedRows) => (
          <>
            <span className="text-sm font-medium text-muted-foreground mr-2">
              {selectedRows.length} selected
            </span>
            <Button
              variant="destructive"
              size="sm"
              className="h-8 gap-1.5"
              disabled={deleteMutation.isPending}
              onClick={async () => {
                const ok = await confirm({
                  title: `Delete heatmap data for ${selectedRows.length} page${selectedRows.length === 1 ? '' : 's'}?`,
                  description: 'Every click, move and scroll recorded on those pages is removed.',
                  confirmLabel: 'Delete data',
                  destructive: true,
                });
                if (ok) deleteMutation.mutate(selectedRows.map(r => r.url));
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </>
        )}
        toolbarLeft={
          <div>
            <h3 className=" font-semibold text-foreground">Heatmap Pages</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {filtered.length} page{filtered.length !== 1 ? 's' : ''} tracked
            </p>
          </div>
        }


        toolbarRight={
          <div className="flex items-center gap-2">
            <RangeSelect value={days} onChange={setDays} ranges={HEATMAP_RANGES} />
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search pages..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs w-48"
              />
            </div>
          </div>
        }
        onRowClick={row => router.push(heatmapHref(row.url))}
        emptyIcon={<Flame className="h-6 w-6" />}
        emptyTitle="No heatmap data yet"
        emptyDescription="Install the tracker script, then open Settings → Features to enable heatmaps and adjust URL include/exclude patterns (localhost is often blocked by include rules). Run npm run bundle-trackers in seentics/web after changing the tracker."
        pageSize={10}
      />

      {!embed && (
        <ListGroups
          className="mt-6"
          title="Pages by what visitors do"
          description="From each page's clicks and scrolls in this period. Open a group to see its pages."
          groups={HEATMAP_GROUP_META.map((meta) => ({
            ...meta,
            items: pages
              .filter((p) => inHeatmapGroup(p, meta.id))
              .map((p) => ({ key: p.url, text: `${p.url} — ${heatmapLine(p)}`, onClick: () => router.push(heatmapHref(p.url)) })),
          }))}
          onShowAll={(id) => { setGroupFilter(id as HeatmapGroupId); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        />
      )}
    </div>
  );
}
