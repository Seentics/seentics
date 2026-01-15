'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { formatDuration, formatNumber, formatPercentage } from '@/lib/analytics-api';
import { ArrowDownRight, ArrowUpRight, ChevronRight, Clock, Eye, Minus, TrendingDown, Users, Wifi } from 'lucide-react';
import React from 'react';

interface SummaryCardsProps {
  data: any;
}

const GrowthIndicator = ({ current, previous, inverse = false }: {
  current: number;
  previous: number;
  inverse?: boolean;
}) => {
  if (previous === 0) {
    if (current > 0) return <span className="text-green-600 dark:text-green-400 text-xs sm:text-sm flex items-center"><ArrowUpRight className="h-2 w-2 sm:h-3 sm:w-3 mr-1" />New</span>;
    return <span className="text-muted-foreground text-xs sm:text-sm">No change</span>;
  }
  if (current === previous) {
    return <span className="text-muted-foreground text-xs sm:text-sm flex items-center"><Minus className="h-2 w-2 sm:h-3 sm:w-3 mr-1" />No change</span>;
  }

  const growth = ((current - previous) / previous) * 100;
  const isPositive = inverse ? growth < 0 : growth > 0;

  return (
    <div className={`flex items-center text-xs sm:text-sm ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
      {isPositive ? <ArrowUpRight className="h-2 w-2 sm:h-3 sm:w-3 mr-1" /> : <ArrowDownRight className="h-2 w-2 sm:h-3 sm:w-3 mr-1" />}
      <span>{Math.abs(growth).toFixed(1)}%</span>
    </div>
  );
};

const SummaryCard = ({
  title,
  value,
  previousValue,
  icon: Icon,
  format = 'number',
  isLoading = false,
  inverse = false,
  subtitle,
}: {
  title: string;
  value: number;
  previousValue?: number;
  icon: any;
  format?: 'number' | 'percentage' | 'duration';
  isLoading?: boolean;
  inverse?: boolean;
  subtitle?: string;
}) => {
  const formatValue = (val: number) => {
    switch (format) {
      case 'percentage':
        return formatPercentage(val);
      case 'duration':
        return formatDuration(val);
      default:
        return formatNumber(val);
    }
  };

  if (isLoading) {
    return (
      <div className="group cursor-default hover:bg-gradient-to-br hover:from-gray-50 hover:to-gray-100 dark:hover:from-gray-800 dark:hover:to-gray-700 transition-all duration-300 p-5 sm:p-6 overflow-hidden">
        <div className="flex items-center justify-between pb-2.5">
          <div className="text-sm font-semibold text-foreground/90 truncate pr-2">{title}</div>
          <div className="flex items-center gap-1 shrink-0">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0" />
          </div>
        </div>
        <div>
          <Skeleton className="h-8 w-24 mb-2" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    );
  }

  return (
    <div className="group cursor-default hover:bg-gradient-to-br hover:from-gray-50 hover:to-gray-100 dark:hover:from-gray-800 dark:hover:to-gray-700 transition-all duration-300 p-5 sm:p-6 overflow-hidden">
      <div className="flex items-center justify-between pb-2.5">
        <div className="text-sm font-semibold text-foreground/90 truncate pr-2">{title}</div>
        <div className="flex items-center gap-1 shrink-0">
          <Icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground/70 transition-colors" />
          <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0" />
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="text-2xl font-bold leading-tight text-foreground group-hover:text-foreground/90 transition-colors">{formatValue(value)}</div>
        {previousValue !== undefined && (
          <div>
            <GrowthIndicator current={value} previous={previousValue} inverse={inverse} />
          </div>
        )}
        {subtitle && (
          <div className="text-xs text-muted-foreground font-medium truncate">{subtitle}</div>
        )}
        {format === 'duration' && !subtitle && (
          <div className="text-xs text-muted-foreground font-medium truncate">&nbsp;</div>
        )}
      </div>
    </div>
  );
};

export function SummaryCards({ data }: SummaryCardsProps) {
  if (!data) {
    return (
      <div className="bg-white dark:bg-transparent  border border-gray-200 dark:border-gray-600 shadow-md">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-x divide-gray-200 dark:divide-white">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-6">
              <Skeleton className="h-8 w-24 mb-2" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const cards = [
    {
      title: 'Total Visitors',
      value: data.total_visitors || 0,
      previousValue: data.comparison?.visitor_change,
      icon: Users,
      format: 'number' as const,
    },
    {
      title: 'Unique Visitors',
      value: data.unique_visitors || 0,
      previousValue: undefined,
      icon: Users,
      format: 'number' as const,
      subtitle: 'Distinct visitors',
    },
    {
      title: 'Page Views',
      value: data.page_views || 0,
      previousValue: data.comparison?.pageview_change,
      icon: Eye,
      format: 'number' as const,
    },
    {
      title: 'Session Duration',
      value: data.session_duration || 0,
      previousValue: data.comparison?.duration_change,
      icon: Clock,
      format: 'duration' as const,
      inverse: true,
    },
    {
      title: 'Bounce Rate',
      value: data.bounce_rate || 0,
      previousValue: data.comparison?.bounce_change,
      icon: TrendingDown,
      format: 'percentage' as const,
      inverse: true,
    },
  ];

  return (
    <div className="bg-white dark:bg-gray-800  border dark:border-gray-800 rounded-md">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 divide-x divide-gray-100 dark:divide-gray-700">
        {cards.map((card, index) => (
          <SummaryCard key={index} {...card} />
        ))}
      </div>
    </div>
  );
}; 