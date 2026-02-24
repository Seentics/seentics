'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, TrendingUp, Users, Zap } from 'lucide-react';
import { formatNumber } from '@/lib/analytics-api';
import { cn } from '@/lib/utils';

interface VisitorActivityProps {
  activityTrends?: any;
  dashboardData?: {
    live_visitors?: number;
    session_duration?: number;
    bounce_rate?: number;
    page_views?: number;
    unique_visitors?: number;
  };
  isLoading?: boolean;
}

export function VisitorActivity({ activityTrends, dashboardData, isLoading }: VisitorActivityProps) {
  if (isLoading) {
    return (
      <Card className="border border-border/60 bg-card shadow-sm">
        <CardHeader className="pb-4">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-1 items-end h-24">
              {[...Array(24)].map((_, i) => (
                <Skeleton key={i} className="flex-1 rounded-sm" style={{ height: `${20 + Math.random() * 60}%` }} />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Normalize trends data — backend returns { trends: [{ timestamp, visitors, page_views, label }] }
  // Frontend API types expect { trends: [{ hour, users, pageViews }] }
  const rawTrends = Array.isArray(activityTrends?.trends) ? activityTrends.trends : [];
  const currentHour = new Date().getHours();

  // Parse each trend item into a normalized shape
  const parsedTrends = rawTrends.map((t: any) => {
    // Extract hour from label ("14:00") or timestamp or hour field
    let hour = -1;
    if (typeof t.hour === 'number') {
      hour = t.hour;
    } else if (typeof t.label === 'string' && t.label.includes(':')) {
      hour = parseInt(t.label.split(':')[0], 10);
    } else if (t.timestamp) {
      hour = new Date(t.timestamp).getHours();
    }
    return {
      hour,
      users: t.visitors ?? t.users ?? 0,
      pageViews: t.page_views ?? t.pageViews ?? 0,
      sessions: t.sessions ?? 0,
    };
  });

  // Build 24-hour data (fill gaps with 0)
  const hourlyData = Array.from({ length: 24 }, (_, hour) => {
    const match = parsedTrends.find((t: any) => t.hour === hour);
    return {
      hour,
      users: match?.users || 0,
      pageViews: match?.pageViews || 0,
      sessions: match?.sessions || 0,
    };
  });

  const maxUsers = Math.max(...hourlyData.map(h => h.users), 1);
  const totalUsers = hourlyData.reduce((sum, h) => sum + h.users, 0);
  const totalPageViews = hourlyData.reduce((sum, h) => sum + h.pageViews, 0);

  // Find peak hour
  const peakHour = hourlyData.reduce((peak, h) => h.users > peak.users ? h : peak, hourlyData[0]);
  const peakLabel = `${peakHour.hour.toString().padStart(2, '0')}:00`;

  // Pages per visitor
  const pagesPerVisitor = totalUsers > 0 ? (totalPageViews / totalUsers).toFixed(1) : '0';

  // Live visitors from dashboard
  const liveVisitors = dashboardData?.live_visitors || 0;

  const formatHourLabel = (hour: number) => {
    if (hour === 0) return '12a';
    if (hour < 12) return `${hour}a`;
    if (hour === 12) return '12p';
    return `${hour - 12}p`;
  };

  return (
    <Card className="border border-border/60 bg-card shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base font-bold tracking-tight">Visitor Activity</CardTitle>
            <p className="text-xs text-muted-foreground">Hourly traffic patterns today</p>
          </div>
          {liveVisitors > 0 && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              {formatNumber(liveVisitors)} live
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {totalUsers === 0 ? (
          <div className="text-center py-8 space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <Clock className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">No activity yet today</p>
              <p className="text-xs text-muted-foreground mt-1">
                Visitor activity patterns will appear here as traffic comes in.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Hourly bar chart */}
            <div className="space-y-2">
              <div className="flex items-end gap-[3px] h-20">
                {hourlyData.map((h) => {
                  const height = maxUsers > 0 ? Math.max((h.users / maxUsers) * 100, 2) : 2;
                  const isCurrent = h.hour === currentHour;
                  const isPeak = h.hour === peakHour.hour && peakHour.users > 0;

                  return (
                    <div
                      key={h.hour}
                      className="group relative flex-1 flex flex-col items-center justify-end h-full"
                    >
                      <div
                        className={cn(
                          "w-full rounded-sm transition-all duration-200",
                          isCurrent
                            ? "bg-emerald-500 shadow-sm shadow-emerald-500/20"
                            : isPeak
                              ? "bg-primary shadow-sm shadow-primary/20"
                              : h.users > 0
                                ? "bg-primary/30 group-hover:bg-primary/50"
                                : "bg-muted/30"
                        )}
                        style={{ height: `${height}%` }}
                      />
                      {/* Tooltip */}
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 hidden group-hover:block z-10">
                        <div className="bg-popover border border-border shadow-lg rounded px-2 py-1 text-[10px] font-medium whitespace-nowrap">
                          <span className="text-muted-foreground">{h.hour.toString().padStart(2, '0')}:00</span>
                          <span className="mx-1 text-border">|</span>
                          <span className="text-foreground">{formatNumber(h.users)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Hour labels */}
              <div className="flex gap-[3px]">
                {hourlyData.map((h) => (
                  <div key={h.hour} className="flex-1 text-center">
                    {h.hour % 6 === 0 && (
                      <span className="text-[8px] text-muted-foreground/60 font-medium">
                        {formatHourLabel(h.hour)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded border border-border/40 p-3 hover:bg-accent/5 transition-colors">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Zap className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Peak Hour</span>
                </div>
                <p className="text-lg font-bold leading-tight">{peakLabel}</p>
                <p className="text-[10px] text-muted-foreground">{formatNumber(peakHour.users)} visitors</p>
              </div>

              <div className="rounded border border-border/40 p-3 hover:bg-accent/5 transition-colors">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Users className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Today</span>
                </div>
                <p className="text-lg font-bold leading-tight">{formatNumber(totalUsers)}</p>
                <p className="text-[10px] text-muted-foreground">total visitors</p>
              </div>

              <div className="rounded border border-border/40 p-3 hover:bg-accent/5 transition-colors">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <TrendingUp className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Depth</span>
                </div>
                <p className="text-lg font-bold leading-tight">{pagesPerVisitor}</p>
                <p className="text-[10px] text-muted-foreground">pages/visitor</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
