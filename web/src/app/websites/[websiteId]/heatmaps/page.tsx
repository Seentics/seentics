'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  Activity,
  MousePointer2,
  MousePointerClick,
  Trash2,
  Zap,
  Settings as SettingsIcon,
  Eye,
  Search,
} from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from 'next/link';
import api from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { isDemo as checkIsDemo, demoHeatmapPages } from '@/lib/demo';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { useSubscription } from '@/hooks/useSubscription';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DataTable, ColumnDef, SortableHeader, selectionColumn } from '@/components/ui/data-table';

function getPageLabel(url: string): string {
  if (url === '/') return 'Homepage';
  const segments = url.split('/').filter(Boolean);
  const last = segments[segments.length - 1];
  // If the last segment is a UUID, use the second-to-last
  if (/^[0-9a-f]{8}-[0-9a-f]{4}/.test(last) && segments.length > 1) {
    return segments[segments.length - 2].charAt(0).toUpperCase() + segments[segments.length - 2].slice(1);
  }
  return last.charAt(0).toUpperCase() + last.slice(1).replace(/-/g, ' ');
}

export default function HeatmapsPage() {
  const { websiteId } = useParams();
  const { subscription } = useSubscription();

  const { data: website } = useQuery({
    queryKey: ['website', websiteId],
    queryFn: async () => {
      const response = await api.get(`/user/websites/${websiteId}`);
      return response.data?.data ?? response.data;
    },
    enabled: !!websiteId && websiteId !== 'demo',
  });

  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPages, setSelectedPages] = useState<any[]>([]);

  const isDemoMode = checkIsDemo(websiteId as string);
  const isFreePlan = subscription?.plan === 'free';
  const isHeatmapDisabled = website && website.heatmap_enabled === false;

  const fetchPages = async () => {
    if (isDemoMode) { setPages(demoHeatmapPages()); setLoading(false); return; }
    try {
      const response = await api.get(`/heatmaps/pages?website_id=${websiteId}`);
      const apiPages = (response.data.pages || []).map((page: any) => {
        if (typeof page === 'string') return { url: page, views: 0, clicks: 0, avg_scroll: 0, active: true };
        return { url: page.url || page, views: page.views || 0, clicks: page.clicks || 0, avg_scroll: page.avg_scroll || 0, active: page.active !== false };
      });
      setPages(apiPages);
    } catch (err) {
      console.error('Failed to fetch heatmap pages:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPages(); }, [websiteId]);

  const handleDeletePage = useCallback(async (url: string) => {
    if (isDemoMode) { setPages(prev => prev.filter(p => p.url !== url)); return; }
    if (!window.confirm(`Delete heatmap data for ${url}?`)) return;
    try {
      await api.delete(`/heatmaps/pages?website_id=${websiteId}&url=${encodeURIComponent(url)}`);
      setPages(prev => prev.filter(p => p.url !== url));
    } catch (err) {
      console.error('Failed to delete heatmap page:', err);
      alert('Failed to delete heatmap page data. Please try again.');
    }
  }, [isDemoMode, websiteId]);

  const handleBulkDelete = async () => {
    const selectedUrls = selectedPages.map((p: any) => p.url);
    if (selectedUrls.length === 0) return;
    if (isDemoMode) {
      setPages(pages.filter(p => !selectedUrls.includes(p.url)));
      setSelectedPages([]);
      return;
    }
    if (!window.confirm(`Delete heatmap data for ${selectedUrls.length} selected pages?`)) return;
    try {
      await api.delete('/heatmaps/bulk-delete', { data: { website_id: websiteId, urls: selectedUrls } });
      setPages(pages.filter(p => !selectedUrls.includes(p.url)));
      setSelectedPages([]);
    } catch (err) {
      alert('Failed to delete selected pages. Please try again.');
    }
  };

  const filteredData = useMemo(() =>
    pages.filter(p => p.url.toLowerCase().includes(searchTerm.toLowerCase())),
    [pages, searchTerm]
  );

  const maxViews = useMemo(() => Math.max(...pages.map((p: any) => p.views), 1), [pages]);
  const maxClicks = useMemo(() => Math.max(...pages.map((p: any) => p.clicks), 1), [pages]);

  const columns = useMemo((): ColumnDef<any>[] => [
    selectionColumn<any>(),
    {
      accessorKey: 'url',
      header: 'Page',
      cell: ({ row }) => {
        const page = row.original;
        return (
          <Link
            href={`/websites/${websiteId}/heatmaps/view?url=${encodeURIComponent(page.url)}`}
            className="flex items-center gap-3 min-w-0"
            onClick={(e) => e.stopPropagation()}
          >
            {/* <div className={cn(
              'h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0',
              page.active ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-muted/50 text-muted-foreground'
            )}>
              <BarChart3 className="h-4 w-4" />
            </div> */}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground hover:text-primary transition-colors truncate">
                  {getPageLabel(page.url)}
                </p>
                {page.active && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0" />}
              </div>
              <p className="text-xs text-muted-foreground/70 truncate max-w-[340px] mt-0.5 font-mono">{page.url}</p>
            </div>
          </Link>
        );
      },
    },
    {
      accessorKey: 'views',
      header: ({ column }) => <SortableHeader column={column}>Views</SortableHeader>,
      size: 120,
      cell: ({ row }) => (
        <div className="flex flex-col items-center gap-1">
          <span className="text-sm font-semibold tabular-nums">{row.original.views.toLocaleString()}</span>
          <div className="h-1 w-12 bg-muted/60 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500/60 rounded-full" style={{ width: `${Math.min(100, (row.original.views / maxViews) * 100)}%` }} />
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'clicks',
      header: ({ column }) => <SortableHeader column={column}>Clicks</SortableHeader>,
      size: 120,
      cell: ({ row }) => (
        <div className="flex flex-col items-center gap-1">
          <span className="text-sm font-semibold tabular-nums">{row.original.clicks.toLocaleString()}</span>
          <div className="h-1 w-12 bg-muted/60 rounded-full overflow-hidden">
            <div className="h-full bg-violet-500/60 rounded-full" style={{ width: `${Math.min(100, (row.original.clicks / maxClicks) * 100)}%` }} />
          </div>
        </div>
      ),
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      size: 110,
      cell: ({ row }) => {
        const page = row.original;
        return (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 text-muted-foreground/50 hover:text-rose-500 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all"
                    onClick={() => handleDeletePage(page.url)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">Delete data</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Link href={`/websites/${websiteId}/heatmaps/view?url=${encodeURIComponent(page.url)}`}>
              <Button size="sm" variant="secondary"
                className="h-7 gap-1.5 px-2.5 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-all shadow-sm border border-primary/10">
                <Eye className="h-3.5 w-3.5" /> View
              </Button>
            </Link>
          </div>
        );
      },
    },
  ], [maxViews, maxClicks, websiteId, handleDeletePage]);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1400px] mx-auto animate-in fade-in duration-500">
      {isHeatmapDisabled && !isFreePlan && !isDemoMode && (
        <Alert className="bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20">
          <MousePointer2 className="h-4 w-4 text-rose-600" />
          <AlertTitle className="text-rose-700 dark:text-rose-500 font-semibold">Heatmaps Disabled</AlertTitle>
          <AlertDescription className="text-rose-600/80 dark:text-muted-foreground/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <span>Heatmap tracking is currently disabled for this website.</span>
            <Link href={`/websites/${websiteId}/settings?tab=heatmaps`}>
              <Button size="sm" variant="outline" className="border-rose-300 dark:border-rose-500/30 text-rose-700 dark:text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-500/10 gap-2 text-xs font-medium">
                <SettingsIcon className="h-3.5 w-3.5" /> Open Settings
              </Button>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <DashboardPageHeader
        title="Heatmaps"
        description="Visualize where users click, move, and scroll across your pages."
        icon={MousePointer2}
      >
        <Link href={`/websites/${websiteId}/settings?tab=heatmaps`}>
          <Button variant="outline" className="gap-2 h-9 text-xs font-medium">
            <SettingsIcon className="h-3.5 w-3.5" /> Settings
          </Button>
        </Link>
      </DashboardPageHeader>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatsCard title="Total Pages" value={pages.length} icon={Activity} description="Pages with data" color="blue" />
        <StatsCard title="Live Tracking" value={pages.filter(p => p.active).length} icon={Zap} description="Currently recording" color="emerald" />
        <StatsCard title="Total Clicks" value={pages.reduce((acc, p) => acc + p.clicks, 0)} icon={MousePointerClick} description="Last 30 days" color="violet" />
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredData}
        isLoading={loading}
        enableRowSelection
        onRowSelectionChange={setSelectedPages}
        emptyIcon={<MousePointer2 className="h-6 w-6" />}
        emptyTitle={searchTerm ? 'No matching pages' : 'No heatmap data yet'}
        emptyDescription={
          searchTerm
            ? 'Try adjusting your search term.'
            : 'Once visitors start interacting with your site, their behaviour data will appear here.'
        }
        emptyAction={
          !searchTerm ? (
            <Link href={`/websites/${websiteId}/settings?tab=heatmaps`}>
              <Button variant="outline" size="sm" className="gap-2 text-xs">
                <SettingsIcon className="h-3.5 w-3.5" /> Configure Tracking
              </Button>
            </Link>
          ) : undefined
        }
        toolbarLeft={
          <div>
            <h3 className="text-base font-semibold">Tracked Pages</h3>
            <p className="text-sm text-muted-foreground mt-0.5">{filteredData.length} {filteredData.length === 1 ? 'page' : 'pages'} tracked</p>
          </div>
        }
        selectionActions={(rows) => (
          <>
            <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">{rows.length} selected</span>
            <Button variant="destructive" size="sm" className="h-8 gap-2 text-xs" onClick={handleBulkDelete}>
              <Trash2 className="h-3.5 w-3.5" /> Delete Selected
            </Button>
          </>
        )}
        toolbarRight={
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Filter pages..."
              className="pl-8 w-full md:w-[240px] h-8 text-sm bg-muted/30 border-border/50 focus-visible:ring-1 focus-visible:ring-primary/30"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        }
      />
    </div>
  );
}

function StatsCard({ title, value, icon: Icon, description, color = 'blue' }: any) {
  const bgMap: Record<string, string> = {
    blue: 'bg-blue-500/10',
    emerald: 'bg-emerald-500/10',
    violet: 'bg-violet-500/10',
    amber: 'bg-amber-500/10',
  };
  const iconMap: Record<string, string> = {
    blue: 'text-blue-500',
    emerald: 'text-emerald-500',
    violet: 'text-violet-500',
    amber: 'text-amber-500',
  };
  return (
    <Card className="border border-border/60 bg-card shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-semibold tracking-tight">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <div className={cn('shrink-0 h-9 w-9 rounded-lg flex items-center justify-center', bgMap[color])}>
            <Icon className={cn('h-4 w-4', iconMap[color])} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
