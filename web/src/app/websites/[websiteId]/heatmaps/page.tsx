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
  SortAsc,
  SortDesc,
  TrendingUp,
  Globe,
  Eye,
  CheckSquare,
  Square
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
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
  const isFreePlan = subscription?.plan === 'free';
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
        <CardHeader className="border-b border-border/40 pb-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-semibold">Tracked Pages</CardTitle>
              <CardDescription className="text-sm mt-0.5">Select a page to view its heatmap analysis</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search pages..."
                  className="pl-8 w-full md:w-[220px] h-8 text-sm bg-muted/30 border-border/50"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={sortBy} onValueChange={(v) => handleSortChange(v as SortKey)}>
                <SelectTrigger className="w-[150px] h-8 text-xs bg-muted/30 border-border/50">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent"><span className="flex items-center gap-2"><TrendingUp className="h-3 w-3" /> Recent</span></SelectItem>
                  <SelectItem value="views"><span className="flex items-center gap-2"><Eye className="h-3 w-3" /> Views</span></SelectItem>
                  <SelectItem value="clicks"><span className="flex items-center gap-2"><MousePointerClick className="h-3 w-3" /> Clicks</span></SelectItem>
                  <SelectItem value="scroll"><span className="flex items-center gap-2"><Target className="h-3 w-3" /> Scroll Depth</span></SelectItem>
                </SelectContent>
              </Select>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" className="h-8 w-8 bg-muted/30 border-border/50" onClick={toggleSortDir}>
                      {sortDir === 'desc' ? <SortDesc className="h-3.5 w-3.5" /> : <SortAsc className="h-3.5 w-3.5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{sortDir === 'desc' ? 'Descending' : 'Ascending'}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Select value={String(itemsPerPage)} onValueChange={(v) => setItemsPerPage(Number(v))}>
                <SelectTrigger className="w-[90px] h-8 text-xs bg-muted/30 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 rows</SelectItem>
                  <SelectItem value="25">25 rows</SelectItem>
                  <SelectItem value="50">50 rows</SelectItem>
                </SelectContent>
              </Select>
              {selectedUrls.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8 gap-2 px-3 text-xs font-medium animate-in zoom-in-95 duration-200"
                  onClick={handleBulkDelete}
                  disabled={isDeletingBulk}
                >
                  <Trash2 className="h-3 w-3" />
                  Delete Selected ({selectedUrls.length})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded" />)}
            </div>
          ) : filteredAndSorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="h-16 w-16 bg-muted/50 rounded-full flex items-center justify-center mb-5">
                <MousePointer2 className="h-7 w-7 text-muted-foreground/40" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                {searchTerm ? 'No matching pages' : 'No heatmap data yet'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1.5">
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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border/40 bg-muted/20">
                      <TableHead className="w-[40px] px-4 py-3">
                        <Checkbox
                          checked={currentItems.length > 0 && selectedUrls.length === currentItems.length}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Select all"
                        />
                      </TableHead>
                      <TableHead className="px-5 py-3 text-xs font-medium text-muted-foreground text-left">Page</TableHead>
                      <TableHead
                        className="py-3 text-xs font-medium text-muted-foreground text-center cursor-pointer select-none hover:text-foreground transition-colors"
                        onClick={() => handleSortChange('views')}
                      >
                        <span className="inline-flex items-center gap-1">
                          Views {sortBy === 'views' && (sortDir === 'desc' ? <SortDesc className="h-3 w-3" /> : <SortAsc className="h-3 w-3" />)}
                        </span>
                      </TableHead>
                      <TableHead
                        className="py-3 text-xs font-medium text-muted-foreground text-center cursor-pointer select-none hover:text-foreground transition-colors"
                        onClick={() => handleSortChange('clicks')}
                      >
                        <span className="inline-flex items-center gap-1">
                          Clicks {sortBy === 'clicks' && (sortDir === 'desc' ? <SortDesc className="h-3 w-3" /> : <SortAsc className="h-3 w-3" />)}
                        </span>
                      </TableHead>
                      <TableHead
                        className="py-3 text-xs font-medium text-muted-foreground text-center cursor-pointer select-none hover:text-foreground transition-colors"
                        onClick={() => handleSortChange('scroll')}
                      >
                        <span className="inline-flex items-center gap-1">
                          Scroll {sortBy === 'scroll' && (sortDir === 'desc' ? <SortDesc className="h-3 w-3" /> : <SortAsc className="h-3 w-3" />)}
                        </span>
                      </TableHead>
                      <TableHead className="py-3 text-xs font-medium text-muted-foreground text-center">Status</TableHead>
                      <TableHead className="px-5 py-3 text-xs font-medium text-muted-foreground text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentItems.map((page) => (
                      <TableRow key={page.url} className={cn("group hover:bg-muted/30 transition-colors border-border/30", selectedUrls.includes(page.url) && "bg-muted/40")}>
                        <TableCell className="px-4 py-3.5">
                          <Checkbox
                            checked={selectedUrls.includes(page.url)}
                            onCheckedChange={() => toggleSelectUrl(page.url)}
                            aria-label={`Select ${page.url}`}
                          />
                        </TableCell>
                        <TableCell className="px-5 py-3.5">
                          <Link
                            href={`/websites/${websiteId}/heatmaps/view?url=${encodeURIComponent(page.url)}`}
                            className="flex items-center gap-3 min-w-0"
                          >
                            <div className="h-8 w-8 rounded-lg bg-muted/60 flex items-center justify-center flex-shrink-0">
                              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate max-w-[320px]" title={page.url}>
                                {page.url}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {page.url === '/' ? 'Homepage' : page.url.split('/').filter(Boolean).pop() || 'Root'}
                              </p>
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell className="py-3.5 text-center">
                          <div className="flex flex-col items-center gap-1.5">
                            <span className="text-sm font-semibold tabular-nums">{page.views.toLocaleString()}</span>
                            <div className="h-1 w-14 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500/70 rounded-full transition-all" style={{ width: `${Math.min(100, (page.views / maxViews) * 100)}%` }} />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-3.5 text-center">
                          <div className="flex flex-col items-center gap-1.5">
                            <span className="text-sm font-semibold tabular-nums">{page.clicks.toLocaleString()}</span>
                            <div className="h-1 w-14 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-violet-500/70 rounded-full transition-all" style={{ width: `${Math.min(100, (page.clicks / maxClicks) * 100)}%` }} />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-3.5 text-center">
                          <div className="flex flex-col items-center gap-1.5">
                            <span className="text-sm font-semibold tabular-nums">{page.avg_scroll}%</span>
                            <div className="h-1 w-14 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-amber-500/70 rounded-full transition-all" style={{ width: `${page.avg_scroll}%` }} />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <span className={cn("h-1.5 w-1.5 rounded-full", page.active ? "bg-emerald-500" : "bg-muted-foreground/30")} />
                            <span className={cn("text-xs", page.active ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                              {page.active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5  transition-opacity">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost" size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10"
                                    onClick={() => handleDeletePage(page.url)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Delete data</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <Link href={`/websites/${websiteId}/heatmaps/view?url=${encodeURIComponent(page.url)}`}>
                              <Button size="sm" className="h-7 px-3 gap-1.5 text-xs font-medium">
                                View <ArrowUpRight className="h-3 w-3" />
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="px-5 py-3 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  {totalItems === 0 ? 'No results' : `Showing ${(currentPage - 1) * itemsPerPage + 1}–${Math.min(currentPage * itemsPerPage, totalItems)} of ${totalItems}`}
                </p>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-7 w-7" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    {paginationRange.map((item, idx) =>
                      item === '...' ? (
                        <span key={`ellipsis-${idx}`} className="h-7 w-7 flex items-center justify-center text-xs text-muted-foreground">…</span>
                      ) : (
                        <Button
                          key={item}
                          variant={currentPage === item ? "default" : "outline"}
                          size="icon"
                          className={cn("h-7 w-7 text-xs", currentPage === item && "pointer-events-none")}
                          onClick={() => setCurrentPage(item as number)}
                        >
                          {item}
                        </Button>
                      )
                    )}
                    <Button variant="outline" size="icon" className="h-7 w-7" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
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
