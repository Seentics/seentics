'use client';

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Target, MousePointerClick, Eye } from 'lucide-react';
import { formatNumber } from '@/lib/analytics-api';
import { cn } from '@/lib/utils';

interface GoalItem {
  event_type: string;
  count: number;
  sample_properties?: Record<string, any>;
}

interface GoalConversionsProps {
  items: GoalItem[];
  totalVisitors?: number;
  isLoading?: boolean;
}

export function GoalConversions({ items, totalVisitors = 0, isLoading }: GoalConversionsProps) {
  if (isLoading) {
    return (
      <div className="space-y-0">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center justify-between py-3 border-b border-border last:border-0">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <Skeleton className="h-5 w-14" />
          </div>
        ))}
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/40 bg-accent/5 rounded-lg border border-dashed border-border">
        <Target className="h-10 w-10 mb-2 opacity-20" />
        <p className="text-xs font-medium text-muted-foreground/60">No goals configured</p>
      </div>
    );
  }

  const sortedItems = [...items].sort((a, b) => b.count - a.count);
  const maxCount = sortedItems[0]?.count || 1;

  const isPageGoal = (item: GoalItem): boolean => {
    return !!(item.sample_properties?.page && Object.keys(item.sample_properties).length === 1);
  };

  const getConversionRate = (count: number): string | null => {
    if (totalVisitors <= 0) return null;
    const rate = (count / totalVisitors) * 100;
    if (rate >= 100) return '100%';
    if (rate >= 10) return `${rate.toFixed(1)}%`;
    return `${rate.toFixed(1)}%`;
  };

  return (
    <div className="max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
      <div className="space-y-0">
        {sortedItems.map((item, index) => {
          const isPage = isPageGoal(item);
          const convRate = getConversionRate(item.count);
          const barWidth = (item.count / maxCount) * 100;

          return (
            <div
              key={`${item.event_type}-${index}`}
              className="group relative flex items-center justify-between py-3 px-1 border-b border-border last:border-0 hover:bg-accent/5 transition-colors"
            >
              {/* Background bar */}
              <div
                className="absolute inset-y-0 left-0 bg-primary/[0.04] group-hover:bg-primary/[0.07] transition-colors rounded-lg-r"
                style={{ width: `${barWidth}%` }}
              />

              {/* Left: icon + name */}
              <div className="flex items-center gap-3 flex-1 min-w-0 relative z-10">
                <div className="flex-shrink-0 p-2 bg-accent/10 rounded-lg group-hover:bg-primary/10 transition-colors">
                  {isPage ? (
                    <Eye className="w-4 h-4 text-indigo-500" />
                  ) : (
                    <MousePointerClick className="w-4 h-4 text-emerald-500" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm leading-tight text-foreground truncate group-hover:text-primary transition-colors">
                    {item.event_type}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-medium truncate opacity-50">
                    {isPage ? item.sample_properties?.page || 'Page visit' : 'Custom event'}
                  </div>
                </div>
              </div>

              {/* Right: rate + count */}
              <div className="flex items-center gap-4 shrink-0 relative z-10">
                {convRate && (
                  <span className="text-xs font-semibold text-primary hidden sm:block">
                    {convRate}
                  </span>
                )}
                <div className="text-right">
                  <div className="font-bold text-base leading-tight tracking-tight">
                    {formatNumber(item.count)}
                  </div>
                  <div className="text-[10px] text-muted-foreground opacity-50">
                    conversions
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
