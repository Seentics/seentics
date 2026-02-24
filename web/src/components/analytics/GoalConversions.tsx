'use client';

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Target, MousePointerClick, Eye, TrendingUp, Trophy } from 'lucide-react';
import { formatNumber } from '@/lib/analytics-api';
import { cn } from '@/lib/utils';

interface GoalItem {
  event_type: string; // goal name from backend
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
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="p-4 rounded-lg border border-border/40">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-6 w-16" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-center space-y-4 opacity-50 bg-accent/5 rounded-lg border border-dashed border-border/60">
        <div className="h-16 w-16 bg-accent/20 rounded-full flex items-center justify-center">
          <Target className="h-8 w-8 text-muted-foreground opacity-20" />
        </div>
        <div>
          <p className="text-sm font-bold text-muted-foreground">No goals configured</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Create goals to track conversions and measure success.
          </p>
        </div>
      </div>
    );
  }

  const maxCount = Math.max(...items.map(i => i.count), 1);

  // Detect goal type from sample_properties
  const getGoalType = (item: GoalItem): 'event' | 'pageview' => {
    if (item.sample_properties?.page && Object.keys(item.sample_properties).length === 1) {
      return 'pageview';
    }
    return 'event';
  };

  const getGoalIcon = (type: 'event' | 'pageview') => {
    return type === 'pageview' ? Eye : MousePointerClick;
  };

  const getConversionRate = (count: number): string => {
    if (totalVisitors <= 0) return '—';
    const rate = (count / totalVisitors) * 100;
    if (rate >= 100) return '100%';
    if (rate >= 10) return `${rate.toFixed(1)}%`;
    return `${rate.toFixed(2)}%`;
  };

  // Rank items by count to assign rank badges
  const sortedItems = [...items].sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
      {sortedItems.map((item, index) => {
        const goalType = getGoalType(item);
        const GoalIcon = getGoalIcon(goalType);
        const barWidth = (item.count / maxCount) * 100;
        const conversionRate = getConversionRate(item.count);
        const isTop = index === 0 && items.length > 1;

        return (
          <div
            key={`${item.event_type}-${index}`}
            className={cn(
              "group relative p-4 rounded-lg border transition-all duration-200 hover:bg-accent/5",
              isTop
                ? "border-primary/20 bg-primary/[0.02]"
                : "border-border/40"
            )}
          >
            {/* Header row */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className={cn(
                  "h-9 w-9 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                  isTop
                    ? "bg-primary/10 text-primary"
                    : "bg-accent/10 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                )}>
                  {isTop ? (
                    <Trophy className="h-4 w-4" />
                  ) : (
                    <GoalIcon className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground truncate">
                      {item.event_type}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[9px] px-1.5 py-0 font-bold uppercase tracking-wider h-4 shrink-0",
                        goalType === 'pageview'
                          ? "bg-blue-500/5 border-blue-500/20 text-blue-500"
                          : "bg-emerald-500/5 border-emerald-500/20 text-emerald-500"
                      )}
                    >
                      {goalType === 'pageview' ? 'Page' : 'Event'}
                    </Badge>
                  </div>
                  {goalType === 'pageview' && item.sample_properties?.page && (
                    <p className="text-[10px] text-muted-foreground/60 font-mono truncate mt-0.5">
                      {item.sample_properties.page}
                    </p>
                  )}
                </div>
              </div>

              {/* Right side: count + conversion rate */}
              <div className="flex items-center gap-4 shrink-0">
                {totalVisitors > 0 && (
                  <div className="text-right hidden sm:block">
                    <div className="flex items-center gap-1 text-xs font-bold text-primary">
                      <TrendingUp className="h-3 w-3" />
                      {conversionRate}
                    </div>
                    <div className="text-[9px] text-muted-foreground/50 font-medium uppercase tracking-wider">
                      conv. rate
                    </div>
                  </div>
                )}
                <div className="text-right">
                  <div className="text-base font-bold tracking-tight leading-tight">
                    {formatNumber(item.count)}
                  </div>
                  <div className="text-[9px] text-muted-foreground/50 font-medium uppercase tracking-wider">
                    conversions
                  </div>
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-accent/10 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  isTop ? "bg-primary" : "bg-primary/40 group-hover:bg-primary/60"
                )}
                style={{ width: `${barWidth}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
