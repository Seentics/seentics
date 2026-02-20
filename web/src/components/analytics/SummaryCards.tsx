'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { formatDuration, formatNumber, formatPercentage, useLiveVisitors } from '@/lib/analytics-api';
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
  Activity,
  Radio
} from 'lucide-react';
import React from 'react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface SummaryCardsProps {
  data: any;
  websiteId?: string;
  isDemo?: boolean;
  isLoading?: boolean;
}

const GrowthIndicator = ({ current, previous, inverse = false }: {
  current: number;
  previous: number;
  inverse?: boolean;
}) => {
  if (previous === 0) {
    if (current > 0) return <span className="text-emerald-500 text-[10px] font-medium flex items-center bg-emerald-500/10 px-1.5 py-0.5 rounded">New</span>;
    return <span className="text-muted-foreground/40 text-[10px] font-medium ml-2">—</span>;
  }
  if (current === previous) {
    return <span className="text-muted-foreground/40 text-[10px] font-medium">0.0%</span>;
  }

  const growth = ((current - previous) / previous) * 100;
  const isPositive = inverse ? growth < 0 : growth > 0;

  return (
    <div className={cn(
        "flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded",
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
  href,
}: {
  title: string;
  value: number;
  previousValue?: number;
  icon: any;
  format?: 'number' | 'percentage' | 'duration';
  isLoading?: boolean;
  inverse?: boolean;
  subtitle?: string;
  href?: string;
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

  const content = (
    <>
      <div className="flex items-center justify-between pb-3">
        <div className="text-xs font-medium text-muted-foreground group-hover:opacity-100 transition-opacity whitespace-nowrap overflow-hidden text-ellipsis">
          {title}
        </div>
        <div className="h-7 w-7 rounded bg-accent/5 flex items-center justify-center group-hover:bg-primary/5 transition-colors">
          <Icon className={cn(
            "h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-primary transition-colors",
            title === 'Live Visitors' && "text-emerald-500"
          )} />
        </div>
      </div>
      
      <div className="flex items-end justify-between gap-2">
        <div className="space-y-0 relative z-10 min-w-0 flex-1">
          <div className={cn(
            "text-2xl font-bold tracking-tight text-foreground/80 group-hover:text-primary transition-all duration-300 whitespace-nowrap",
            title === 'Live Visitors' && "text-emerald-500 group-hover:text-emerald-400"
          )}>
            {formatValue(value)}
          </div>
          {/* {subtitle && (
            <div className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider opacity-40 mt-1 whitespace-nowrap">{subtitle}</div>
          )} */}
        {previousValue !== undefined && (
          <div className="mt-2 inline-block p-0">
            <GrowthIndicator current={value} previous={previousValue} inverse={inverse} />
          </div>
        )}
        </div>
        

        {href && (
           <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-all group-hover:translate-x-1 flex-shrink-0" />
        )}
      </div>

    </>
  );

  if (href) {
    return (
      <Link href={href} className="group relative p-6 transition-all duration-300 hover:bg-accent/5 overflow-hidden block">
        {content}
      </Link>
    );
  }

  return (
    <div className="group relative p-6 transition-all duration-300 hover:bg-accent/5 overflow-hidden">
      {content}
    </div>
  );
};

export function SummaryCards({ data, websiteId, isDemo, isLoading }: SummaryCardsProps) {
  const { data: liveVisitors, isLoading: liveLoading } = useLiveVisitors(websiteId || '');
  
  if (isLoading || !data) {
    return (
      <div className="border border-border/60 bg-card shadow-sm rounded overflow-hidden mb-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-x divide-border/20">
          {[...Array(6)].map((_, i) => (
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
      title: 'Live Visitors',
      value: liveVisitors || 0,
      icon: Radio,
      format: 'number' as const,
      subtitle: 'Active now',
    },
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
      inverse: false,
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
    <div className="border border-border/60 bg-card dark:border-none shadow-sm rounded overflow-hidden mb-8">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-x divide-border/40">
        {cards.map((card, index) => (
          <SummaryCard key={index} {...card} />
        ))}
      </div>
    </div>
  );
}
