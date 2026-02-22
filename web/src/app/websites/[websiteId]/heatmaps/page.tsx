'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
  Activity,
  MousePointer2,
  MousePointerClick,
  Trash2,
  ArrowUpRight,
  Zap,
  Target,
  Search,
  Sparkles,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Eye,
  BarChart3,
  ExternalLink,
} from 'lucide-react';
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import Link from 'next/link';
import api from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
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

type SortKey = 'recent' | 'views' | 'clicks' | 'scroll';
type SortDir = 'asc' | 'desc';

function getPaginationRange(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, '...', total];
  if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '...', current - 1, current, current + 1, '...', total];
}

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
  const [sortBy, setSortBy] = useState<SortKey>('recent');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  const isDemo = websiteId === 'demo';
  const isFreePlan = subscription?.plan === 'starter';
  const isHeatmapDisabled = website && website.heatmap_enabled === false;

  const fetchPages = async () => {
    if (isDemo) { setPages([]); setLoading(false); return; }
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

  const handleDeletePage = async (url: string) => {
    if (isDemo) { setPages(pages.filter(p => p.url !== url)); return; }
    if (!window.confirm(`Delete heatmap data for ${url}?`)) return;
    try {
      await api.delete(`/heatmaps/pages?website_id=${websiteId}&url=${encodeURIComponent(url)}`);
      setPages(pages.filter(p => p.url !== url));
      setSelectedUrls(prev => prev.filter(u => u !== url));
    } catch (err) {
      console.error('Failed to delete heatmap page:', err);
      alert('Failed to delete heatmap page data. Please try again.');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedUrls.length === 0) return;
    if (isDemo) {
      setPages(pages.filter(p => !selectedUrls.includes(p.url)));
      setSelectedUrls([]);
      return;
    }

    if (!window.confirm(`Delete heatmap data for ${selectedUrls.length} selected pages?`)) return;

    setIsDeletingBulk(true);
    try {
      await api.delete('/heatmaps/bulk-delete', {
        data: {
          website_id: websiteId,
          urls: selectedUrls
        }
      });
      setPages(pages.filter(p => !selectedUrls.includes(p.url)));
      setSelectedUrls([]);
    } catch (err) {
      console.error('Failed to bulk delete heatmap pages:', err);
      alert('Failed to delete selected pages. Please try again.');
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedUrls.length === currentItems.length) {
      setSelectedUrls([]);
    } else {
      setSelectedUrls(currentItems.map(p => p.url));
    }
  };

  const toggleSelectUrl = (url: string) => {
    setSelectedUrls(prev =>
      prev.includes(url)
        ? prev.filter(u => u !== url)
        : [...prev, url]
    );
  };

  const filteredAndSorted = useMemo(() => {
    let result = pages.filter(page =>
      page.url.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const dir = sortDir === 'asc' ? 1 : -1;
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'views':   return (a.views - b.views) * dir;
        case 'clicks':  return (a.clicks - b.clicks) * dir;
        case 'scroll':  return (a.avg_scroll - b.avg_scroll) * dir;
        default:        return 0;
      }
    });
    return result;
  }, [pages, searchTerm, sortBy, sortDir]);

  const totalItems = filteredAndSorted.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const currentItems = filteredAndSorted.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const paginationRange = getPaginationRange(currentPage, totalPages);

  const toggleSortDir = () => setSortDir(d => d === 'asc' ? 'desc' : 'asc');

  const handleSortChange = (value: SortKey) => {
    if (value === sortBy) { toggleSortDir(); } else { setSortBy(value); setSortDir('desc'); }
    setCurrentPage(1);
  };

  useEffect(() => { setCurrentPage(1); }, [searchTerm, itemsPerPage]);

  const maxViews = Math.max(...pages.map((p: any) => p.views), 1);
  const maxClicks = Math.max(...pages.map((p: any) => p.clicks), 1);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1400px] mx-auto animate-in fade-in duration-500">
      {(isFreePlan || isDemo) && (
        <Alert className="bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20">
          <Sparkles className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-700 dark:text-amber-500 font-semibold">Premium Feature</AlertTitle>
          <AlertDescription className="text-amber-600/80 dark:text-muted-foreground/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <span>Real heatmap tracking requires a paid plan. Upgrade to start recording live sessions.</span>
            <Link href={isDemo ? '/pricing' : `/websites/${websiteId}/billing`}>
              <Button size="sm" variant="outline" className="border-amber-300 dark:border-amber-500/30 text-amber-700 dark:text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-500/10 gap-2 text-xs font-medium">
                View Plans <ArrowUpRight className="h-3 w-3" />
              </Button>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {isHeatmapDisabled && !isFreePlan && !isDemo && (
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Pages" value={pages.length} icon={Activity} description="Pages with data" color="blue" />
        <StatsCard title="Live Tracking" value={pages.filter(p => p.active).length} icon={Zap} description="Currently recording" color="emerald" />
        <StatsCard title="Total Clicks" value={pages.reduce((acc, p) => acc + p.clicks, 0)} icon={MousePointerClick} description="Last 30 days" color="violet" />
        <StatsCard
          title="Avg. Scroll Depth"
          value={pages.length > 0 ? `${Math.round(pages.reduce((acc, p) => acc + p.avg_scroll, 0) / pages.length)}%` : '—'}
          icon={Target} description="Across all pages" color="amber"
        />
      </div>

      {/* Table */}
      <Card className="border border-border/60 bg-card shadow-sm overflow-hidden">
        {/* Header toolbar */}
        <div className="px-5 py-4 border-b border-border/40">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-foreground">Tracked Pages</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                {totalItems} {totalItems === 1 ? 'page' : 'pages'} tracked
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filter pages..."
                  className="pl-8 w-full md:w-[240px] h-8 text-sm bg-muted/30 border-border/50 focus-visible:ring-1 focus-visible:ring-primary/30"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={sortBy} onValueChange={(v) => handleSortChange(v as SortKey)}>
                <SelectTrigger className="w-[140px] h-8 text-xs bg-muted/30 border-border/50">
                  <ArrowUpDown className="h-3 w-3 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Recent</SelectItem>
                  <SelectItem value="views">Views</SelectItem>
                  <SelectItem value="clicks">Clicks</SelectItem>
                  <SelectItem value="scroll">Scroll Depth</SelectItem>
                </SelectContent>
              </Select>
              <Select value={String(itemsPerPage)} onValueChange={(v) => setItemsPerPage(Number(v))}>
                <SelectTrigger className="w-[80px] h-8 text-xs bg-muted/30 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
              {selectedUrls.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8 gap-1.5 px-3 text-xs font-medium animate-in zoom-in-95 duration-200"
                  onClick={handleBulkDelete}
                  disabled={isDeletingBulk}
                >
                  <Trash2 className="h-3 w-3" />
                  Delete ({selectedUrls.length})
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-5 space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
          </div>
        ) : filteredAndSorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="h-14 w-14 bg-muted/40 rounded-2xl flex items-center justify-center mb-4">
              <MousePointer2 className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              {searchTerm ? 'No matching pages' : 'No heatmap data yet'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1">
              {searchTerm
                ? 'Try adjusting your search term.'
                : 'Once visitors start interacting with your site, their behavior data will appear here.'}
            </p>
            {!searchTerm && (
              <Link href={`/websites/${websiteId}/settings?tab=heatmaps`} className="mt-4">
                <Button variant="outline" size="sm" className="gap-2 text-xs">
                  <SettingsIcon className="h-3.5 w-3.5" /> Configure Tracking
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div className="grid grid-cols-[40px_1fr_100px_100px_100px_110px] items-center px-5 py-2.5 border-b border-border/30 bg-muted/10 text-xs font-medium text-muted-foreground">
              <div className="flex items-center justify-center">
                <Checkbox
                  checked={currentItems.length > 0 && selectedUrls.length === currentItems.length}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </div>
              <div className="pl-1">Page</div>
              <div
                className="text-center cursor-pointer select-none hover:text-foreground transition-colors"
                onClick={() => handleSortChange('views')}
              >
                Views {sortBy === 'views' && (sortDir === 'desc' ? '\u2193' : '\u2191')}
              </div>
              <div
                className="text-center cursor-pointer select-none hover:text-foreground transition-colors"
                onClick={() => handleSortChange('clicks')}
              >
                Clicks {sortBy === 'clicks' && (sortDir === 'desc' ? '\u2193' : '\u2191')}
              </div>
              <div
                className="text-center cursor-pointer select-none hover:text-foreground transition-colors"
                onClick={() => handleSortChange('scroll')}
              >
                Scroll {sortBy === 'scroll' && (sortDir === 'desc' ? '\u2193' : '\u2191')}
              </div>
              <div />
            </div>

            {/* Rows */}
            <div className="divide-y divide-border/20">
              {currentItems.map((page) => (
                <div
                  key={page.url}
                  className={cn(
                    "group grid grid-cols-[40px_1fr_100px_100px_100px_110px] items-center px-5 py-3 transition-colors hover:bg-muted/20",
                    selectedUrls.includes(page.url) && "bg-primary/[0.03]"
                  )}
                >
                  {/* Checkbox */}
                  <div className="flex items-center justify-center">
                    <Checkbox
                      checked={selectedUrls.includes(page.url)}
                      onCheckedChange={() => toggleSelectUrl(page.url)}
                      aria-label={`Select ${page.url}`}
                    />
                  </div>

                  {/* Page info */}
                  <Link
                    href={`/websites/${websiteId}/heatmaps/view?url=${encodeURIComponent(page.url)}`}
                    className="flex items-center gap-3 min-w-0 pl-1"
                  >
                    <div className={cn(
                      "h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors",
                      page.active
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-muted/50 text-muted-foreground"
                    )}>
                      <BarChart3 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate" title={page.url}>
                          {getPageLabel(page.url)}
                        </p>
                        {page.active && (
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground/70 truncate max-w-[400px] mt-0.5 font-mono" title={page.url}>
                        {page.url}
                      </p>
                    </div>
                  </Link>

                  {/* Views */}
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-sm font-semibold tabular-nums text-foreground">{page.views.toLocaleString()}</span>
                    <div className="h-1 w-12 bg-muted/60 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500/60 rounded-full transition-all" style={{ width: `${Math.min(100, (page.views / maxViews) * 100)}%` }} />
                    </div>
                  </div>

                  {/* Clicks */}
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-sm font-semibold tabular-nums text-foreground">{page.clicks.toLocaleString()}</span>
                    <div className="h-1 w-12 bg-muted/60 rounded-full overflow-hidden">
                      <div className="h-full bg-violet-500/60 rounded-full transition-all" style={{ width: `${Math.min(100, (page.clicks / maxClicks) * 100)}%` }} />
                    </div>
                  </div>

                  {/* Scroll Depth */}
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-sm font-semibold tabular-nums text-foreground">{page.avg_scroll}%</span>
                    <div className="h-1 w-12 bg-muted/60 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${page.avg_scroll}%`,
                          backgroundColor: page.avg_scroll >= 70 ? 'rgb(34 197 94 / 0.6)' : page.avg_scroll >= 40 ? 'rgb(245 158 11 / 0.6)' : 'rgb(239 68 68 / 0.6)',
                        }}
                      />
                    </div>
                  </div>

                  {/* Action */}
                  <div className="flex items-center justify-end gap-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 text-muted-foreground/50 hover:text-rose-500 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all"
                            onClick={(e) => { e.preventDefault(); handleDeletePage(page.url); }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left">Delete data</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <Link href={`/websites/${websiteId}/heatmaps/view?url=${encodeURIComponent(page.url)}`}>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-primary hover:bg-primary/10"
                      >
                        <Eye className="h-3.5 w-3.5" /> View
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="px-5 py-3 border-t border-border/30 flex flex-col sm:flex-row items-center justify-between gap-3 bg-muted/5">
              <p className="text-xs text-muted-foreground">
                {totalItems === 0 ? 'No results' : `${(currentPage - 1) * itemsPerPage + 1}–${Math.min(currentPage * itemsPerPage, totalItems)} of ${totalItems} pages`}
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  {paginationRange.map((item, idx) =>
                    item === '...' ? (
                      <span key={`ellipsis-${idx}`} className="h-7 w-7 flex items-center justify-center text-xs text-muted-foreground">…</span>
                    ) : (
                      <Button
                        key={item}
                        variant={currentPage === item ? "default" : "ghost"}
                        size="icon"
                        className={cn("h-7 w-7 text-xs", currentPage === item && "pointer-events-none")}
                        onClick={() => setCurrentPage(item as number)}
                      >
                        {item}
                      </Button>
                    )
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function StatsCard({ title, value, icon: Icon, description, color = 'blue' }: any) {
  const accentMap: Record<string, string> = {
    blue: 'bg-blue-500',
    emerald: 'bg-emerald-500',
    violet: 'bg-violet-500',
    amber: 'bg-amber-500',
  };
  const iconMap: Record<string, string> = {
    blue: 'text-blue-500',
    emerald: 'text-emerald-500',
    violet: 'text-violet-500',
    amber: 'text-amber-500',
  };
  return (
    <Card className="relative overflow-hidden border border-border/60 bg-card shadow-sm">
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentMap[color]}`} />
      <CardHeader className="pb-1 pl-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{title}</span>
          <Icon className={cn("h-4 w-4", iconMap[color])} />
        </div>
      </CardHeader>
      <CardContent className="pl-5 pt-0">
        <div className="text-2xl font-semibold tracking-tight">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </CardContent>
    </Card>
  );
}
