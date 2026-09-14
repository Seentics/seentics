import { Skeleton } from '@/components/ui/skeleton';
import { formatDuration, formatPercentage } from '@/features/analytics/format';
import { cn } from '@/lib/utils';
import {
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Eye,
  Radio,
  TrendingDown,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

type SummaryMetric = {
  sessions?: number;
  unique_visitors?: number;
  total_visitors?: number;
  page_views?: number;
  avg_session_time?: number;
  bounce_rate?: number;
};

export type SummaryCardsData = SummaryMetric & {
  live_visitors?: number;
  metrics?: SummaryMetric;
  session_duration?: number;
  comparison?: {
    current_period?: SummaryMetric;
    previous_period?: SummaryMetric;
  };
};

export interface SummaryCardsViewProps {
  data?: SummaryCardsData | null;
  liveVisitors?: number;
  isLoading?: boolean;
}

function GrowthBadge({
  current,
  previous,
  inverse = false,
}: {
  current: number;
  previous: number;
  inverse?: boolean;
}) {
  if (previous === 0) {
    if (current > 0) {
      return (
        <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          New
        </span>
      );
    }

    return <span className="text-[10px] text-muted-foreground/40">—</span>;
  }

  if (current === previous) {
    return (
      <span className="text-[10px] font-medium text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded-lg">
        No change
      </span>
    );
  }

  const rawGrowth = ((current - previous) / previous) * 100;
  const growth = Math.max(-100, Math.min(999, rawGrowth));
  const isGood = inverse ? growth < 0 : growth > 0;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-lg',
        isGood
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
      )}
    >
      {isGood ? (
        <ArrowUpRight className="h-2.5 w-2.5" strokeWidth={3} />
      ) : (
        <ArrowDownRight className="h-2.5 w-2.5" strokeWidth={3} />
      )}
      {Math.abs(growth) >= 999 ? '999+' : `${Math.abs(growth).toFixed(1)}`}%
    </span>
  );
}

function SummaryCard({
  title,
  value,
  previousValue,
  icon: Icon,
  format = 'number',
  isLoading = false,
  inverse = false,
  customContent,
}: {
  title: string;
  value: number;
  previousValue?: number;
  icon: LucideIcon;
  format?: 'number' | 'percentage' | 'duration';
  isLoading?: boolean;
  inverse?: boolean;
  customContent?: ReactNode;
}) {
  const formatValue = (valueToFormat: number) => {
    if (format === 'percentage') return formatPercentage(valueToFormat);
    if (format === 'duration') return formatDuration(valueToFormat);
    return valueToFormat.toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="p-5">
        <Skeleton className="h-3 w-20 mb-4 rounded-lg" />
        <Skeleton className="h-7 w-16 mb-2 rounded-lg" />
        <Skeleton className="h-3 w-10 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="group p-5 hover:bg-accent/5 transition-colors">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-lg bg-accent/40 flex items-center justify-center shrink-0">
          {title === 'Live Visitors' ? (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          ) : (
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
        <span className="text-[11px] font-medium text-muted-foreground truncate">{title}</span>
      </div>

      {customContent ?? (
        <div>
          <div
            className={cn(
              'text-lg font-bold tracking-tight leading-none mb-2 text-foreground',
              title === 'Live Visitors' && 'text-emerald-500',
            )}
          >
            {formatValue(value)}
          </div>
          {previousValue !== undefined && (
            <GrowthBadge current={value} previous={previousValue} inverse={inverse} />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Presentation-only dashboard summary. Feed it API data, fixtures, or a recorded
 * state from the outside; it never fetches data or owns dashboard state.
 */
export function SummaryCardsView({ data, liveVisitors = 0, isLoading = false }: SummaryCardsViewProps) {
  if (isLoading || !data) {
    return (
      <div className="surface overflow-hidden mb-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-x divide-y divide-border lg:divide-y-0">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="p-5">
              <Skeleton className="h-3 w-20 mb-4 rounded-lg" />
              <Skeleton className="h-7 w-16 mb-2 rounded-lg" />
              <Skeleton className="h-3 w-10 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const currentPeriod = data.comparison?.current_period;
  const previousPeriod = data.comparison?.previous_period;
  const sessions = currentPeriod?.sessions ?? data.sessions ?? data.metrics?.sessions ?? 0;
  const uniqueVisitors =
    currentPeriod?.unique_visitors ?? data.unique_visitors ?? data.metrics?.unique_visitors ?? 0;
  const pageViews = currentPeriod?.page_views ?? data.page_views ?? 0;
  const sessionDuration = currentPeriod?.avg_session_time ?? data.session_duration ?? 0;
  const bounceRate = currentPeriod?.bounce_rate ?? data.bounce_rate ?? 0;

  const cards = [
    { title: 'Live Visitors', value: liveVisitors, icon: Radio, format: 'number' as const },
    {
      title: 'Unique Visitors',
      value: uniqueVisitors,
      previousValue: previousPeriod?.unique_visitors ?? previousPeriod?.total_visitors,
      icon: UserCheck,
      format: 'number' as const,
    },
    {
      title: 'Total visitors',
      value: sessions,
      previousValue: previousPeriod?.sessions,
      icon: Users,
      format: 'number' as const,
    },
    {
      title: 'Page Views',
      value: pageViews,
      previousValue: previousPeriod?.page_views,
      icon: Eye,
      format: 'number' as const,
    },
    {
      title: 'Session Duration',
      value: sessionDuration,
      previousValue: previousPeriod?.avg_session_time,
      icon: Clock,
      format: 'duration' as const,
    },
    {
      title: 'Bounce Rate',
      value: bounceRate,
      previousValue: previousPeriod?.bounce_rate,
      icon: TrendingDown,
      format: 'percentage' as const,
      inverse: true,
    },
  ];

  return (
    <div className="surface overflow-hidden mb-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-x divide-y divide-border lg:divide-y-0">
        {cards.map((card) => (
          <SummaryCard key={card.title} {...card} />
        ))}
      </div>
    </div>
  );
}
