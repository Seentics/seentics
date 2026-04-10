'use client';

import { useMemo, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { DataTable, SortableHeader, ColumnDef, selectionColumn } from '@/components/ui/data-table';

import { StatCards } from '@/components/seentics-ui/StatCards';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Flame, Eye, MousePointer, Move, Search, Activity, Trash2,
  Copy, ExternalLink, RefreshCw,
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

import { cn } from '@/lib/utils';

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

  const title = path;
  const relative = stripWebsiteDashboardPrefix(path, websiteId);
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
  const params     = useParams();
  const router     = useRouter();
  const websiteId  = params?.websiteId as string;
  const isDemoMode = isDemo(websiteId);
  const queryClient = useQueryClient();
  const { toast }   = useToast();
  const [search, setSearch] = useState('');

  const heatmapHref = useCallback(
    (pagePath: string) =>
      `/websites/${websiteId}/heatmaps/${heatmapPageSlug(pagePath)}`,
    [websiteId],
  );

  const copyHeatmapLink = useCallback(
    (pagePath: string) => {
      const path = heatmapHref(pagePath);
      const full = typeof window !== 'undefined' ? `${window.location.origin}${path}` : path;
      void navigator.clipboard.writeText(full).then(() => {
        toast({ title: 'Heatmap link copied', description: 'Share this URL to open the same view.' });
      });
    },
    [heatmapHref, toast],
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
    queryKey:  ['heatmap-pages', websiteId],
    queryFn:   () => listHeatmapPages(websiteId),
    enabled:   !isDemoMode,
    staleTime: 60_000,
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

  const columns: ColumnDef<PageRow>[] = useMemo(() => [
    selectionColumn<PageRow>(),
    {
      id: 'url',

      header: ({ column }) => <SortableHeader column={column}>Page</SortableHeader>,
      accessorKey: 'url',
      cell: ({ row }) => {
        const { display, title } = heatmapPathDisplay(row.original.url, websiteId);
        return (
          <div className="min-w-0 max-w-[min(100%,36rem)]">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full shrink-0 mt-px',
                  row.original.active ? 'bg-emerald-500/90' : 'bg-muted-foreground/35',
                )}
                title={row.original.active ? 'Receiving data' : 'Inactive'}
              />
              <span className="font-mono text-xs text-foreground truncate" title={title}>
                {display}
              </span>
            </div>
            {row.original.last_seen ? (
              <p className="text-[11px] text-muted-foreground tabular-nums pl-3.5 mt-0.5">
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
      size: 100,
      cell: ({ getValue }) => (
        <span className="text-sm tabular-nums text-foreground">{(getValue() as number).toLocaleString()}</span>
      ),
    },
    {
      id: 'clicks',
      header: ({ column }) => <SortableHeader column={column}>Clicks</SortableHeader>,
      accessorKey: 'clicks',
      size: 100,
      cell: ({ getValue }) => (
        <span className="text-sm tabular-nums text-foreground">{(getValue() as number).toLocaleString()}</span>
      ),
    },
    {
      id: 'actions',
      header: '',
      size: 112,
      cell: ({ row }) => (
        <div className="flex justify-end items-center gap-0 pr-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title="Copy link to this heatmap"
            onClick={(e) => {
              e.stopPropagation();
              copyHeatmapLink(row.original.url);
            }}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-primary hover:bg-primary/10"
            title="Open heatmap"
            onClick={(e) => {
              e.stopPropagation();
              router.push(heatmapHref(row.original.url));
            }}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
            title="Delete data for this page"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('Delete heatmap data for this page?')) {
                deleteMutation.mutate([row.original.url]);
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ], [copyHeatmapLink, heatmapHref, router, deleteMutation, websiteId]);


  return (
    <div className="w-full max-w-[1440px] mx-auto p-4 md:p-6 lg:p-8">
      <DashboardPageHeader
        title="Heatmaps"
        description="See where users click, move, and how far they scroll on each page."
      >
        {!isDemoMode && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            disabled={isFetching}
            onClick={() => refetch()}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
            Refresh
          </Button>
        )}
      </DashboardPageHeader>

      {isError && !isDemoMode && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription className="text-sm">
            {(error as Error)?.message ?? 'Could not load heatmap pages. Check your connection and try again.'}
          </AlertDescription>
        </Alert>
      )}

      <StatCards cards={[
        { label: 'Total Views',      value: totalViews,             icon: Eye },
        { label: 'Total Clicks',     value: totalClicks,            icon: MousePointer, iconColor: 'text-primary' },
        { label: 'Avg Scroll Depth', value: avgScroll > 0 ? `${avgScroll}%` : '—', icon: Move, iconColor: 'text-indigo-600' },
        { label: 'Active Pages',     value: activePages,            icon: Activity, iconColor: 'text-green-600', valueColor: 'text-green-600' },
      ]} />

      <DataTable
        className="border border-border/50 bg-card/50 shadow-sm rounded-xl overflow-hidden [&_tbody_tr]:transition-colors [&_td]:!py-2.5 [&_th]:!py-3"
        data={filtered}
        columns={columns}
        isLoading={isLoading}
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
                if (confirm(`Are you sure you want to delete heatmap data for ${selectedRows.length} page(s)?`)) {
                  deleteMutation.mutate(selectedRows.map(r => r.url));
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
            <h3 className="text-sm font-semibold text-foreground">Heatmap Pages</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {filtered.length} page{filtered.length !== 1 ? 's' : ''} tracked
            </p>
          </div>
        }


        toolbarRight={
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search pages..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs w-48"
            />
          </div>
        }
        onRowClick={row => router.push(heatmapHref(row.url))}
        emptyIcon={<Flame className="h-6 w-6" />}
        emptyTitle="No heatmap data yet"
        emptyDescription="Install the tracker script to start collecting heatmap data."
      />
    </div>
  );
}
