'use client';

import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useTopPages, useTopReferrers, formatNumber } from '@/lib/analytics-api';
import { ChevronRight, ExternalLink, FileText, Home } from 'lucide-react';

interface AnalyticsTableProps {
  siteId: string | null;
}

function getPageLabel(page: string) {
  try {
    const u = new URL(page);
    if (u.pathname === '/') return 'Homepage';
    return u.pathname + u.search;
  } catch {
    if (page === '/') return 'Homepage';
    return page;
  }
}

function getPageIcon(page: string) {
  const label = getPageLabel(page);
  if (label === 'Homepage') return <Home className="h-4 w-4 text-primary" />;
  if (label.startsWith('/blog')) return <FileText className="h-4 w-4 text-emerald-600" />;
  return <ExternalLink className="h-4 w-4 text-muted-foreground" />;
}

export function AnalyticsTable({ siteId }: AnalyticsTableProps) {
  const { data: topPages, isLoading: pagesLoading } = useTopPages(siteId || '', 7);
  const { data: topReferrers, isLoading: refsLoading } = useTopReferrers(siteId || '', 7);

  const pages = (topPages?.top_pages || []).filter((p) => (p.views || 0) > 0).slice(0, 5);
  const refs = (topReferrers?.top_referrers || []).filter((r) => (r.views || 0) > 0).slice(0, 5);
  // List-only presentation preferred

  if (!siteId) {
    return null;
  }

  // Demo mode - return demo data with full styling
  if (siteId === 'demo') {
    const demoPages = [
      { page: '/', views: Math.floor(Math.random() * 5000 + 2000) },
      { page: '/products', views: Math.floor(Math.random() * 3000 + 1500) },
      { page: '/about', views: Math.floor(Math.random() * 2000 + 1000) },
      { page: '/contact', views: Math.floor(Math.random() * 1500 + 800) },
      { page: '/blog', views: Math.floor(Math.random() * 2500 + 1200) }
    ];

    const demoReferrers = [
      { referrer: 'google', views: Math.floor(Math.random() * 3000 + 1500) },
      { referrer: 'direct', views: Math.floor(Math.random() * 2000 + 1000) },
      { referrer: 'facebook', views: Math.floor(Math.random() * 1500 + 800) },
      { referrer: 'twitter', views: Math.floor(Math.random() * 1000 + 500) },
      { referrer: 'linkedin', views: Math.floor(Math.random() * 800 + 400) }
    ];

    function getPageLabel(page: string) {
      if (page === '/') return 'Homepage';
      return page;
    }

    function getPageIcon(page: string) {
      const label = getPageLabel(page);
      if (label === 'Homepage') return <Home className="h-4 w-4 text-primary" />;
      if (label.startsWith('/blog')) return <FileText className="h-4 w-4 text-emerald-600" />;
      return <ExternalLink className="h-4 w-4 text-muted-foreground" />;
    }

    return (
      <Card className="bg-card shadow-sm overflow-hidden">
        <CardHeader className="pb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded">
              <div className="w-2 h-2 bg-white rounded-full"></div>
            </div>
            <CardTitle className="font-headline text-xl text-foreground">Traffic Breakdown</CardTitle>
          </div>
          <CardDescription className="text-sm text-muted-foreground">Top pages and traffic sources over the last 7 days</CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Top Pages */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  Top Pages
                </h3>
                <span className="text-xs text-muted-foreground font-medium">Last 7 days</span>
              </div>

              <ul className="space-y-3">
                {demoPages.map((row, idx) => (
                  <li key={idx} className="group flex items-center justify-between p-3 rounded bg-muted/30 hover:bg-muted/50 transition-all duration-200">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="p-2 bg-gradient-to-br from-blue-500/10 to-blue-600/10 rounded">
                        {getPageIcon(row.page)}
                      </div>
                      <span className="truncate font-medium text-foreground" title={getPageLabel(row.page)}>{getPageLabel(row.page)}</span>
                    </div>
                    <span className="text-muted-foreground font-semibold">{row.views.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Top Sources */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Top Sources
                </h3>
                <span className="text-xs text-muted-foreground font-medium">Last 7 days</span>
              </div>

              <ul className="space-y-3">
                {demoReferrers.map((row, idx) => (
                  <li key={idx} className="group flex items-center justify-between p-3 rounded bg-muted/30 hover:bg-muted/50 transition-all duration-200">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="p-2 bg-gradient-to-br from-green-500/10 to-green-600/10 rounded">
                        <ExternalLink className="h-4 w-4 text-green-600" />
                      </div>
                      <span className="truncate font-medium text-foreground" title={row.referrer === 'direct' ? 'Direct' : row.referrer}>{row.referrer === 'direct' ? 'Direct' : row.referrer}</span>
                    </div>
                    <span className="text-muted-foreground font-semibold">{row.views.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <Button variant="outline" asChild className="group hover:bg-primary hover:text-primary-foreground transition-colors">
              <Link href="/demo/analytics" className="flex items-center gap-2">
                View full analytics <ChevronRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card shadow-sm overflow-hidden">
      <CardHeader className="pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded">
            <div className="w-2 h-2 bg-white rounded-full"></div>
          </div>
          <CardTitle className="font-headline text-xl text-foreground">Traffic Breakdown</CardTitle>
        </div>
        <CardDescription className="text-sm text-muted-foreground">Top pages and traffic sources over the last 7 days</CardDescription>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Top Pages */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                Top Pages
              </h3>
              <span className="text-xs text-muted-foreground font-medium">Last 7 days</span>
            </div>

            {pagesLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : pages.length === 0 ? (
              <div className="text-sm text-muted-foreground h-[200px] flex items-center justify-center rounded border border-border/50 bg-muted/30">
                No page data yet
              </div>
            ) : (
              <ul className="space-y-3">
                {pages.map((row, idx) => (
                  <li key={idx} className="group flex items-center justify-between p-3 rounded bg-muted/30 hover:bg-muted/50 transition-all duration-200">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="p-2 bg-gradient-to-br from-blue-500/10 to-blue-600/10 rounded">
                        {getPageIcon(row.page)}
                      </div>
                      <span className="truncate font-medium text-foreground" title={getPageLabel(row.page)}>{getPageLabel(row.page)}</span>
                    </div>
                    <span className="text-muted-foreground font-semibold">{formatNumber(row.views)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Top Sources */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                Top Sources
              </h3>
              <span className="text-xs text-muted-foreground font-medium">Last 7 days</span>
            </div>

            {refsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : refs.length === 0 ? (
              <div className="text-sm text-muted-foreground h-[200px] flex items-center justify-center rounded border border-border/50 bg-muted/30">
                No source data yet
              </div>
            ) : (
              <ul className="space-y-3">
                {refs.map((row, idx) => (
                  <li key={idx} className="group flex items-center justify-between p-3 rounded bg-muted/30 hover:bg-muted/50 transition-all duration-200">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="p-2 bg-gradient-to-br from-green-500/10 to-green-600/10 rounded">
                        <ExternalLink className="h-4 w-4 text-green-600" />
                      </div>
                      <span className="truncate font-medium text-foreground" title={row.referrer === 'direct' ? 'Direct' : row.referrer}>{row.referrer === 'direct' ? 'Direct' : row.referrer}</span>
                    </div>
                    <span className="text-muted-foreground font-semibold">{formatNumber(row.views)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <Button variant="outline" asChild className="group hover:bg-primary hover:text-primary-foreground transition-colors">
            <Link href={`/websites/${siteId}/analytics`} className="flex items-center gap-2">
              View full analytics <ChevronRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


