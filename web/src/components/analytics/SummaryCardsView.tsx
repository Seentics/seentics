import { StatCards } from '@/components/seentics-ui/StatCards';
import { formatDuration, formatPercentage } from '@/features/analytics/format';
import { cn } from '@/lib/utils';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

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

/**
 * Presentation-only dashboard summary. Feed it API data, fixtures, or a recorded
 * state from the outside; it never fetches data or owns dashboard state.
 */
export function SummaryCardsView({ data, liveVisitors = 0, isLoading = false }: SummaryCardsViewProps) {
  if (isLoading || !data) return <StatCards cards={[]} cols={6} isLoading />;

  const currentPeriod = data.comparison?.current_period;
  const previousPeriod = data.comparison?.previous_period;
  const sessions = currentPeriod?.sessions ?? data.sessions ?? data.metrics?.sessions ?? 0;
  const uniqueVisitors =
    currentPeriod?.unique_visitors ?? data.unique_visitors ?? data.metrics?.unique_visitors ?? 0;
  const pageViews = currentPeriod?.page_views ?? data.page_views ?? 0;
  const sessionDuration = currentPeriod?.avg_session_time ?? data.session_duration ?? 0;
  const bounceRate = currentPeriod?.bounce_rate ?? data.bounce_rate ?? 0;

  const growth = (current: number, previous: number | undefined, inverse = false) =>
    previous === undefined ? undefined : <GrowthBadge current={current} previous={previous} inverse={inverse} />;

  return (
    <StatCards
      cols={6}
      cards={[
        { label: 'Live visitors', value: liveVisitors, live: true, subtext: 'Right now' },
        {
          label: 'Unique visitors',
          value: uniqueVisitors,
          delta: growth(uniqueVisitors, previousPeriod?.unique_visitors ?? previousPeriod?.total_visitors),
        },
        { label: 'Total visitors', value: sessions, delta: growth(sessions, previousPeriod?.sessions) },
        { label: 'Page views', value: pageViews, delta: growth(pageViews, previousPeriod?.page_views) },
        { label: 'Session duration', value: formatDuration(sessionDuration), delta: growth(sessionDuration, previousPeriod?.avg_session_time) },
        { label: 'Bounce rate', value: formatPercentage(bounceRate), delta: growth(bounceRate, previousPeriod?.bounce_rate, true) },
      ]}
    />
  );
}
