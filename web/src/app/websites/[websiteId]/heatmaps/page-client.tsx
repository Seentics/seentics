'use client';

import { usePathSegment } from '@/lib/path-segment';

import { useMemo, useState, useCallback } from 'react';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useAppNavigation } from '@/lib/embed-nav';
import { useQuery } from '@tanstack/react-query';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { DataTable, SortableHeader, ColumnDef, selectionColumn } from '@/components/ui/data-table';

import { StatCards } from '@/components/seentics-ui/StatCards';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Flame, Eye, MousePointer, Move, Search, Activity, Trash2,
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

/** A count with a bar under it, drawn against the busiest row, so rows compare at a glance. */
function ShareCell({ value, max, barClass }: { value: number; max: number; barClass: string }) {
  return (
    <div className="w-24">
      <p className="text-sm font-semibold tabular-nums text-foreground">{value.toLocaleString()}</p>
      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full', barClass)}
          style={{ width: `${Math.max(3, Math.round((value / max) * 100))}%` }}
        />
      </div>
    </div>
  );
}

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

// Unified row type for table (merges demo + real data shapes)
interface PageRow {
  url:        string;
  views:      number;
  clicks:     number;
  avg_scroll: number;
  active:     boolean;
  last_seen?: string;
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
      }));
    }
    return (apiPages ?? []).map((p: HeatmapPageSummary) => ({
      url:        p.page_path,
      views:      p.click_count + p.scroll_count,
      clicks:     p.click_count,
      avg_scroll: p.avg_scroll,
      active:     true,
      last_seen:  p.last_seen,
    }));
  }, [isDemoMode, apiPages]);

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
  // Each count's bar is drawn against the busiest page, so rows compare at a glance.
  const maxViews  = Math.max(1, ...pages.map(p => p.views));
  const maxClicks = Math.max(1, ...pages.map(p => p.clicks));

  const columns: ColumnDef<PageRow>[] = useMemo(() => [
    ...(embed ? [] : [selectionColumn<PageRow>()]),
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
            {row.original.last_seen ? (
              <p className="text-[11px] text-muted-foreground tabular-nums pl-[26px] mt-0.5">
                {new Date(row.original.last_seen).toLocaleDateString(undefined, {
                  month: 'numeric',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            ) : null}
          </div>
        );
      },
    },
    {
      id: 'views',
      header: ({ column }) => <SortableHeader column={column}>Views</SortableHeader>,
      accessorKey: 'views',
      size: 120,
      cell: ({ getValue }) => (
        <ShareCell value={getValue() as number} max={maxViews} barClass="bg-primary/60" />
      ),
    },
    {
      id: 'clicks',
      header: ({ column }) => <SortableHeader column={column}>Clicks</SortableHeader>,
      accessorKey: 'clicks',
      size: 120,
      cell: ({ getValue }) => (
        <ShareCell value={getValue() as number} max={maxClicks} barClass="bg-violet-500/60" />
      ),
    },
    {
      id: 'scroll',
      header: ({ column }) => <SortableHeader column={column}>Avg scroll</SortableHeader>,
      accessorKey: 'avg_scroll',
      size: 150,
      cell: ({ getValue }) => {
        const v = Math.max(0, Math.min(100, Math.round(getValue() as number)));
        return (
          <div className="flex items-center gap-2.5">
            <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-amber-500/70" style={{ width: `${v}%` }} />
            </div>
            <span className="text-sm font-semibold tabular-nums text-foreground">{v}%</span>
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
          {!embed && <Button
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
  ], [heatmapHref, router, deleteMutation, websiteId, maxViews, maxClicks, embed]);


  return (
    <div className="w-full max-w-[1440px] mx-auto p-4 md:p-5 lg:px-6 lg:py-5">
      {confirmDialog}
      {embed ? null : <DashboardPageHeader
        websiteId={websiteId}
        title="Heatmaps"
        description="See where users click, move, and how far they scroll on each page."
      >
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
        { label: 'Total Views',      value: totalViews,             icon: Eye, tone: 'info' },
        { label: 'Total Clicks',     value: totalClicks,            icon: MousePointer, tone: 'accent' },
        { label: 'Avg Scroll Depth', value: avgScroll > 0 ? `${avgScroll}%` : '—', icon: Move, tone: 'warning' },
        { label: 'Active Pages',     value: activePages,            icon: Activity, tone: 'success' },
      ]} />

      <DataTable
        className=" shadow-sm rounded-lg overflow-hidden [&_tbody_tr]:transition-colors [&_td]:!py-2 [&_th]:!py-2"
        data={filtered}
        columns={columns}
        isLoading={isLoading}
        enableRowSelection={!embed}
        selectionActions={embed ? undefined : (selectedRows) => (
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
    </div>
  );
}
