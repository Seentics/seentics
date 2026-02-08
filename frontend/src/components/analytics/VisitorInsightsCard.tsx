'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VisitorInsightsData } from '@/lib/analytics-api';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Users, ArrowRightLeft, Clock, TrendingUp, LogIn, LogOut } from 'lucide-react';

interface VisitorInsightsCardProps {
  data?: VisitorInsightsData;
  isLoading?: boolean;
  className?: string;
}

export function VisitorInsightsCard({ data, isLoading, className = '' }: VisitorInsightsCardProps) {
  if (isLoading) {
    return (
      <Card className={cn("bg-card border-border shadow-sm shadow-black/5 rounded overflow-hidden", className)}>
        <CardHeader className="pb-2">
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <div className="h-96 bg-accent/5 rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  const total = (data?.new_visitors || 0) + (data?.returning_visitors || 0);
  const newPercentage = total > 0 ? ((data?.new_visitors || 0) / total * 100) : 0;
  const returningPercentage = total > 0 ? ((data?.returning_visitors || 0) / total * 100) : 0;

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds === 0) return '0s';
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    if (min === 0) return `${sec}s`;
    return `${min}m ${sec}s`;
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="space-y-1">
        <h3 className="text-lg font-bold tracking-tight flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Visitor Behavior
        </h3>
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest opacity-50">User engagement & retention metrics</p>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* New Visitors */}
        <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg p-4 border border-primary/20 hover:border-primary/40 transition-colors group">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-primary/10 rounded">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">New Visitors</p>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-2xl font-black text-foreground">{(data?.new_visitors || 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">First-time users</p>
            </div>
            <div className="text-right">
              <div className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded">
                {newPercentage.toFixed(0)}%
              </div>
            </div>
          </div>
        </div>

        {/* Returning Visitors */}
        <div className="bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 rounded-lg p-4 border border-emerald-500/20 hover:border-emerald-500/40 transition-colors group">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-emerald-500/10 rounded">
              <ArrowRightLeft className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Returning</p>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-2xl font-black text-foreground">{(data?.returning_visitors || 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">Loyal users</p>
            </div>
            <div className="text-right">
              <div className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded">
                {returningPercentage.toFixed(0)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Session Duration */}
      <div className="bg-accent/10 rounded-lg p-4 border border-border/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded">
              <Clock className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Avg Session Duration</p>
              <p className="text-xl font-black text-foreground">{formatDuration(data?.avg_session_duration || 0)}</p>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            per visit
          </div>
        </div>
      </div>

      {/* Entry & Exit Pages */}
      <div className="grid grid-cols-2 gap-4">
        {/* Top Entry Page */}
        <div className="bg-card rounded-lg p-4 border border-border/40 hover:bg-accent/5 transition-colors">
          <div className="flex items-center gap-2 mb-3">
            <LogIn className="h-4 w-4 text-primary" />
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Top Entry</p>
          </div>
          {data?.top_entry_pages && data.top_entry_pages.length > 0 ? (
            <div>
              <p className="text-sm font-bold text-foreground truncate" title={data.top_entry_pages[0].page}>
                {data.top_entry_pages[0].page}
              </p>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-muted-foreground">{data.top_entry_pages[0].sessions.toLocaleString()} sessions</p>
                <p className="text-xs font-bold text-primary">{data.top_entry_pages[0].bounce_rate.toFixed(1)}% bounce</p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No data</p>
          )}
        </div>

        {/* Top Exit Page */}
        <div className="bg-card rounded-lg p-4 border border-border/40 hover:bg-accent/5 transition-colors">
          <div className="flex items-center gap-2 mb-3">
            <LogOut className="h-4 w-4 text-orange-500" />
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Top Exit</p>
          </div>
          {data?.top_exit_pages && data.top_exit_pages.length > 0 ? (
            <div>
              <p className="text-sm font-bold text-foreground truncate" title={data.top_exit_pages[0].page}>
                {data.top_exit_pages[0].page}
              </p>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-muted-foreground">{data.top_exit_pages[0].sessions.toLocaleString()} exits</p>
                <p className="text-xs font-bold text-orange-500">{data.top_exit_pages[0].exit_rate.toFixed(1)}% exit</p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No data</p>
          )}
        </div>
      </div>

      {/* Visual Comparison Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-muted-foreground">Visitor Type Distribution</span>
          <span className="font-bold text-foreground">{total.toLocaleString()} total</span>
        </div>
        <div className="h-3 bg-accent/20 rounded-full overflow-hidden flex">
          <div 
            className="bg-primary transition-all duration-500 relative group"
            style={{ width: `${newPercentage}%` }}
          >
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div 
            className="bg-emerald-500 transition-all duration-500 relative group"
            style={{ width: `${returningPercentage}%` }}
          >
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="font-medium text-muted-foreground">New</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-muted-foreground">Returning</span>
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
        </div>
      </div>
    </div>
  );
}
