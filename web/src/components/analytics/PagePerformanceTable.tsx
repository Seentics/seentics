'use client';

import React, { useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDuration } from '@/lib/analytics-api';
import { cn } from '@/lib/utils';
import { ArrowUpDown, Clock, TrendingDown, Eye, BarChart3 } from 'lucide-react';

interface PageData {
  page: string;
  views: number;
  unique: number;
  avg_time?: number;
  bounce_rate?: number;
}

interface PagePerformanceTableProps {
  data: { top_pages?: PageData[] };
  isLoading?: boolean;
}

type SortKey = 'views' | 'avg_time' | 'bounce_rate';

export function PagePerformanceTable({ data, isLoading }: PagePerformanceTableProps) {
  const [sortBy, setSortBy] = useState<SortKey>('avg_time');
  const [sortDesc, setSortDesc] = useState(true);

  const pages = useMemo(() => {
    const items = (data?.top_pages || []).filter(
      (p) => p.avg_time != null || p.bounce_rate != null
    );
    return [...items].sort((a, b) => {
      const aVal = a[sortBy] ?? 0;
      const bVal = b[sortBy] ?? 0;
      return sortDesc ? bVal - aVal : aVal - bVal;
    });
  }, [data, sortBy, sortDesc]);

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDesc(!sortDesc);
    } else {
      setSortBy(key);
      setSortDesc(true);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center justify-between p-3">
            <Skeleton className="h-4 w-40" />
            <div className="flex gap-6">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-center opacity-50 bg-accent/5 rounded-lg border border-dashed border-border">
        <BarChart3 className="h-8 w-8 text-muted-foreground opacity-20 mb-3" />
        <p className="text-sm font-semibold text-muted-foreground">No performance data</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Page metrics will appear as visitors browse your site</p>
      </div>
    );
  }

  const maxViews = Math.max(...pages.map((p) => p.views || 0), 1);

  const getPathLabel = (page: string) => {
    if (!page) return '/';
    try {
      return new URL(page).pathname;
    } catch {
      return page.startsWith('/') ? page : `/${page}`;
    }
  };

  const SortHeader = ({ label, field, icon: Icon }: { label: string; field: SortKey; icon: any }) => (
    <button
      onClick={() => handleSort(field)}
      className={cn(
        'flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider transition-colors',
        sortBy === field ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
      {sortBy === field && (
        <ArrowUpDown className="h-2.5 w-2.5" />
      )}
    </button>
  );

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="flex items-center px-4 py-2 border-b border-border">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex-1 min-w-0">Page</span>
        <div className="flex items-center shrink-0">
          <div className="w-20 flex justify-end"><SortHeader label="Views" field="views" icon={Eye} /></div>
          <div className="w-24 flex justify-end"><SortHeader label="Time" field="avg_time" icon={Clock} /></div>
          <div className="w-20 flex justify-end"><SortHeader label="Bounce" field="bounce_rate" icon={TrendingDown} /></div>
        </div>
      </div>

      {/* Rows */}
      <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
        {pages.map((page, i) => {
          const path = getPathLabel(page.page);
          const barWidth = ((page.views || 0) / maxViews) * 100;

          return (
            <div
              key={i}
              className="group relative flex items-center justify-between px-4 py-3 hover:bg-accent/5 transition-colors"
            >
              {/* Background bar */}
              <div
                className="absolute inset-y-0 left-0 bg-primary/[0.04] group-hover:bg-primary/[0.07] transition-colors rounded-lg-r"
                style={{ width: `${barWidth}%` }}
              />

              <div className="relative flex items-center gap-2 min-w-0 flex-1">
                <span className="text-[10px] font-bold text-muted-foreground/40 w-5 shrink-0">{i + 1}</span>
                <span className="text-sm font-medium text-foreground truncate" title={page.page}>
                  {path}
                </span>
              </div>

              <div className="relative flex items-center shrink-0">
                <span className="text-sm font-bold tabular-nums w-20 text-right">
                  {(page.views || 0).toLocaleString()}
                </span>
                <span className="text-sm font-bold tabular-nums w-24 text-right">
                  {page.avg_time != null ? formatDuration(page.avg_time) : '—'}
                </span>
                <span className={cn(
                  'text-sm font-bold tabular-nums w-20 text-right',
                  page.bounce_rate != null && page.bounce_rate > 50
                    ? 'text-rose-500'
                    : page.bounce_rate != null && page.bounce_rate < 30
                      ? 'text-emerald-500'
                      : ''
                )}>
                  {page.bounce_rate != null ? `${page.bounce_rate.toFixed(1)}%` : '—'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
