'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { formatDuration, formatNumber, formatPercentage, useLiveVisitors } from '@/lib/analytics-api';
import {
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Eye,
  TrendingDown,
  Users,
  Activity,
  Radio,
  UserCheck,
} from 'lucide-react';
import React from 'react';
import { cn } from '@/lib/utils';

interface SummaryCardsProps {
  data: any;
  websiteId?: string;
  isDemo?: boolean;
  isLoading?: boolean;
  dailyStats?: any;
  visitorInsights?: any;
}


const GrowthBadge = ({ current, previous, inverse = false }: {
  current: number; previous: number; inverse?: boolean;
}) => {
  if (previous === 0) {
    if (current > 0) return (
      <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        New
      </span>
    );
    return <span className="text-[10px] text-muted-foreground/40">—</span>;
  }
  if (current === previous) {
    return <span className="text-[10px] text-muted-foreground/40">0%</span>;
  }
  const rawGrowth = ((current - previous) / previous) * 100;
  const growth = Math.max(-100, Math.min(999, rawGrowth));
  const isGood = inverse ? growth < 0 : growth > 0;
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md',
      isGood ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
    )}>
      {isGood
        ? <ArrowUpRight className="h-2.5 w-2.5" strokeWidth={3} />
        : <ArrowDownRight className="h-2.5 w-2.5" strokeWidth={3} />
      }
      {Math.abs(growth) >= 999 ? '999+' : `${Math.abs(growth).toFixed(1)}`}%
    </span>
  );
};

const SummaryCard = ({
  title, value, previousValue, icon: Icon,
  format = 'number', isLoading = false, inverse = false, customContent,
}: {
  title: string; value: number; previousValue?: number; icon: any;
  format?: 'number' | 'percentage' | 'duration';
  isLoading?: boolean; inverse?: boolean; customContent?: React.ReactNode;
}) => {
  const formatValue = (val: number) => {
    if (format === 'percentage') return formatPercentage(val);
    if (format === 'duration') return formatDuration(val);
    return val.toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="p-5">
        <Skeleton className="h-3 w-20 mb-4 rounded" />
        <Skeleton className="h-7 w-16 mb-2 rounded" />
        <Skeleton className="h-3 w-10 rounded" />
      </div>
    );
  }

  return (
    <div className="group p-5 hover:bg-accent/5 transition-colors">
      {/* Icon + Title row */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-md bg-accent/40 flex items-center justify-center shrink-0">
          {title === 'Live Visitors'
            ? (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            )
            : <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          }
        </div>
        <span className="text-[11px] font-medium text-muted-foreground truncate">{title}</span>
      </div>

      {customContent ?? (
        <div>
          <div className={cn(
            'text-2xl font-bold tracking-tight leading-none mb-2 text-foreground',
            title === 'Live Visitors' && 'text-emerald-500'
          )}>
            {formatValue(value)}
          </div>
          {previousValue !== undefined && (
            <GrowthBadge current={value} previous={previousValue} inverse={inverse} />
          )}
        </div>
      )}
    </div>
  );
};

export function SummaryCards({ data, websiteId, isDemo, isLoading, dailyStats, visitorInsights }: SummaryCardsProps) {
  const { data: liveVisitors } = useLiveVisitors(websiteId || '');

  if (isLoading || !data) {
    return (
      <div className="bg-card shadow-sm rounded overflow-hidden mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 divide-x divide-border/40">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="p-5">
              <Skeleton className="h-3 w-20 mb-4 rounded" />
              <Skeleton className="h-7 w-16 mb-2 rounded" />
              <Skeleton className="h-3 w-10 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const insights = visitorInsights?.visitor_insights;
  const newVisitors = insights?.new_visitors || 0;
  const returningVisitors = insights?.returning_visitors || 0;
  const totalForRatio = newVisitors + returningVisitors || 1;
  const newPct = Math.round((newVisitors / totalForRatio) * 100);

  const cards = [
    { title: 'Live Visitors',    value: isDemo ? (data.live_visitors || 0) : (liveVisitors || 0), icon: Radio, format: 'number' as const },
    { title: 'Total Visitors',   value: data.total_visitors || 0,   previousValue: data.comparison?.previous_period?.total_visitors,   icon: Users,        format: 'number' as const },
    { title: 'Unique Visitors',  value: data.unique_visitors || 0,  previousValue: data.comparison?.previous_period?.unique_visitors,   icon: Activity,     format: 'number' as const },
    { title: 'Page Views',       value: data.page_views || 0,       previousValue: data.comparison?.previous_period?.page_views,        icon: Eye,          format: 'number' as const },
    { title: 'Session Duration', value: data.session_duration || 0, previousValue: data.comparison?.previous_period?.avg_session_time,  icon: Clock,        format: 'duration' as const },
    { title: 'Bounce Rate',      value: data.bounce_rate || 0,      previousValue: data.comparison?.previous_period?.bounce_rate,       icon: TrendingDown, format: 'percentage' as const, inverse: true },
  ];

  return (
    <div className="bg-card shadow-sm rounded overflow-hidden mb-6 border dark:border-none">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 divide-x divide-border/40">
        {cards.map((card, i) => (
          <SummaryCard key={i} {...card} />
        ))}

        {/* New vs Returning */}
        <SummaryCard
          title="New vs Returning"
          value={newVisitors}
          icon={UserCheck}
          customContent={
            <div className="space-y-2.5">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-bold tracking-tight text-foreground">{formatNumber(newVisitors)}</span>
                <span className="text-xs text-muted-foreground/40">/</span>
                <span className="text-xl font-bold tracking-tight text-foreground">{formatNumber(returningVisitors)}</span>
              </div>
              <div className="w-full h-1 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-foreground/60 transition-all duration-700" style={{ width: `${newPct}%` }} />
              </div>
              <div className="flex justify-between text-[10px] font-medium text-muted-foreground">
                <span>New {newPct}%</span>
                <span>Return {100 - newPct}%</span>
              </div>
            </div>
          }
        />
      </div>
    </div>
  );
}
