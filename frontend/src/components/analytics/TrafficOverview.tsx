'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrafficChart } from './TrafficChart';
import { HourlyTrafficChart } from './HourlyTrafficChart';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, List, Clock } from 'lucide-react';

interface TrafficOverviewProps {
  dailyStats: any;
  hourlyStats: any;
  isLoading: boolean;
  className?: string;
}

export function TrafficOverview({
  dailyStats,
  hourlyStats,
  isLoading,
  className,
}: TrafficOverviewProps) {
  const [view, setView] = useState<'chart' | 'list' | 'hourly'>('chart');

  // Prepare list data from daily stats
  const listData = dailyStats?.daily_stats || [];

  return (
    <Card className={cn("col-span-full bg-card/50 shadow-sm shadow-black/5 overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
        <div className="space-y-1">
          <CardTitle className="text-lg font-bold tracking-tight">Traffic Overview</CardTitle>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest opacity-50">Visitor volume over time</p>
        </div>
        {/* View Tabs */}
        <Tabs value={view} onValueChange={(v) => setView(v as any)} className="w-auto">
          <TabsList className="grid w-full grid-cols-3 h-9  p-1 rounded">
            <TabsTrigger value="chart" className="text-[10px] font-semibold uppercase tracking-wider px-3 gap-1.5 rounded active:bg-background">
              <BarChart3 className="h-3.5 w-3.5" />
              Chart
            </TabsTrigger>
            <TabsTrigger value="list" className="text-[10px] font-semibold uppercase tracking-wider px-3 gap-1.5 rounded active:bg-background">
              <List className="h-3.5 w-3.5" />
              List
            </TabsTrigger>
            <TabsTrigger value="hourly" className="text-[10px] font-semibold uppercase tracking-wider px-3 gap-1.5 rounded active:bg-background">
              <Clock className="h-3.5 w-3.5" />
              Hourly
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      
      <CardContent className='p-6 pt-0 border-none outline-none'>
        {view === 'chart' && (
          <div className="h-[400px]">
            <TrafficChart data={dailyStats} isLoading={isLoading} />
          </div>
        )}

        {view === 'list' && (
          <div className="h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded" />
                ))}
              </div>
            ) : listData.length > 0 ? (
              <div className="space-y-3">
                {listData.map((stat: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 bg-accent/5 border border-border/40 rounded hover:bg-accent/10 transition-all duration-300 group"
                  >
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-foreground">
                        {new Date(stat.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider opacity-60">
                         {new Date(stat.date).getFullYear()}
                      </div>
                    </div>
                    <div className="flex items-center gap-8 text-sm">
                      <div className="text-right">
                        <div className="text-[9px] text-muted-foreground font-semibold uppercase tracking-widest opacity-50">Views</div>
                        <div className="font-bold text-primary">
                          {stat.views?.toLocaleString() || 0}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[9px] text-muted-foreground font-semibold uppercase tracking-widest opacity-50">Unique</div>
                        <div className="font-bold text-foreground">
                          {stat.unique?.toLocaleString() || 0}
                        </div>
                      </div>
                      <div className="text-right hidden sm:block">
                        <div className="text-[9px] text-muted-foreground font-semibold uppercase tracking-widest opacity-50">Bounce</div>
                        <div className="font-bold">
                          {stat.bounce_rate?.toFixed(1) || 0}%
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground bg-accent/5 rounded border border-dashed border-border/60">
                <div className="text-center">
                  <List className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                  <p className="text-sm font-bold uppercase tracking-widest opacity-60">No traffic data</p>
                  <p className="text-xs text-muted-foreground/60 italic">Waiting for your first visitors...</p>
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'hourly' && (
          <div className="h-[400px]">
            <HourlyTrafficChart data={hourlyStats} isLoading={isLoading} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
