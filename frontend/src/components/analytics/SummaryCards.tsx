'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { formatDuration, formatNumber, formatPercentage } from '@/lib/analytics-api';
import { 
  ArrowDownRight, 
  ArrowUpRight, 
  ChevronRight, 
  Clock, 
  Eye, 
  Minus, 
  TrendingDown, 
  Users, 
  Zap,
  Activity
} from 'lucide-react';
import React from 'react';
import { cn } from '@/lib/utils';

interface SummaryCardsProps {
  data: any;
}

const GrowthIndicator = ({ current, previous, inverse = false }: {
  current: number;
  previous: number;
  inverse?: boolean;
}) => {
  if (previous === 0) {
    if (current > 0) return <span className="text-emerald-500 text-[10px] font-black uppercase tracking-widest flex items-center bg-emerald-500/10 px-1.5 py-0.5 rounded ml-2">New</span>;
    return <span className="text-muted-foreground/40 text-[10px] uppercase font-bold ml-2">—</span>;
  }
  if (current === previous) {
    return <span className="text-muted-foreground/40 text-[10px] uppercase font-bold ml-2">0.0%</span>;
  }

  const growth = ((current - previous) / previous) * 100;
  const isPositive = inverse ? growth < 0 : growth > 0;

  return (
    <div className={cn(
        "flex items-center text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ml-2",
        isPositive ? 'text-emerald-500 bg-emerald-500/10' : 'text-rose-500 bg-rose-500/10'
    )}>
      {isPositive ? <ArrowUpRight className="h-2.5 w-2.5 mr-0.5" strokeWidth={3} /> : <ArrowDownRight className="h-2.5 w-2.5 mr-0.5" strokeWidth={3} />}
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
      <div className="p-6 transition-all duration-300 border-border/10">
        <div className="flex items-center justify-between pb-4">
          <Skeleton className="h-4 w-24" />
          <Icon className="h-4 w-4 text-muted-foreground opacity-20" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>
    );
  }

  return (
    <div className="group relative p-6 transition-all duration-300 hover:bg-accent/5 overflow-hidden">
      <div className="flex items-center justify-between pb-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest opacity-50 group-hover:opacity-100 transition-opacity whitespace-nowrap overflow-hidden text-ellipsis">
          {title}
        </div>
        <div className="h-7 w-7 rounded bg-accent/5 flex items-center justify-center group-hover:bg-primary/5 transition-colors">
          <Icon className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-primary transition-colors" />
        </div>
      </div>
      
      <div className="flex items-end justify-between">
        <div className="space-y-0 relative z-10">
          <div className="text-2xl font-bold tracking-tight text-foreground/80 group-hover:text-primary transition-all duration-300">
            {formatValue(value)}
          </div>
          {subtitle && (
            <div className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider opacity-40 mt-1">{subtitle}</div>
          )}
        </div>
        
        {previousValue !== undefined && (
          <div className="pb-1">
            <GrowthIndicator current={value} previous={previousValue} inverse={inverse} />
          </div>
        )}
      </div>

      {/* Decorative accent */}
      <div className="absolute -bottom-1 -right-1 h-12 w-12 bg-primary/5 blur-2xl opacity-0 group-hover:opacity-100 transition-all duration-700 rounded-full" />
    </div>
  );
};

export function SummaryCards({ data }: SummaryCardsProps) {
  if (!data) {
    return (
      <div className="bg-card dark:bg-gray-800/50 border-border shadow-sm rounded overflow-hidden mb-8 border">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 divide-x divide-border/20">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="p-6">
              <Skeleton className="h-4 w-20 mb-4" />
              <div className="space-y-2">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-3 w-12" />
              </div>
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
      previousValue: data.comparison?.previous_period?.total_visitors,
      icon: Users,
      format: 'number' as const,
    },
    {
      title: 'Unique Visitors',
      value: data.unique_visitors || 0,
      previousValue: data.comparison?.previous_period?.unique_visitors,
      icon: Activity,
      format: 'number' as const,
      subtitle: 'Distinct visitors',
    },
    {
      title: 'Page Views',
      value: data.page_views || 0,
      previousValue: data.comparison?.previous_period?.page_views,
      icon: Eye,
      format: 'number' as const,
    },
    {
      title: 'Session Duration',
      value: data.session_duration || 0,
      previousValue: data.comparison?.previous_period?.avg_session_time,
      icon: Clock,
      format: 'duration' as const,
      inverse: true,
    },
    {
      title: 'Bounce Rate',
      value: data.bounce_rate || 0,
      previousValue: data.comparison?.previous_period?.bounce_rate,
      icon: TrendingDown,
      format: 'percentage' as const,
      inverse: true,
    },
  ];

  return (
    <div className="bg-gray-200 dark:bg-gray-800/50 shadow-sm shadow-black/5 rounded overflow-hidden mb-8">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 divide-x divide-border/40">
        {cards.map((card, index) => (
          <SummaryCard key={index} {...card} />
        ))}
      </div>
    </div>
  );
}