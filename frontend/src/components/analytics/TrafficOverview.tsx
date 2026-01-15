'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrafficChart } from './TrafficChart';
import { HourlyTrafficChart } from './HourlyTrafficChart';
import { cn } from '@/lib/utils';
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
    <Card className={cn("col-span-full shadow-sm border-gray-200 dark:border-gray-800", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
        <CardTitle className="text-base font-semibold">Traffic Overview</CardTitle>
        
        {/* View Tabs */}
        <Tabs value={view} onValueChange={(v) => setView(v as any)} className="w-auto">
          <TabsList className="grid w-full grid-cols-3 h-9">
            <TabsTrigger value="chart" className="text-xs px-3 gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              Chart
            </TabsTrigger>
            <TabsTrigger value="list" className="text-xs px-3 gap-1.5">
              <List className="h-3.5 w-3.5" />
              List
            </TabsTrigger>
            <TabsTrigger value="hourly" className="text-xs px-3 gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Hourly
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      
      <CardContent>
        {view === 'chart' && (
          <div className="h-[350px]">
            <TrafficChart data={dailyStats} isLoading={isLoading} />
          </div>
        )}

        {view === 'list' && (
          <div className="h-[350px] overflow-y-auto">
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="h-16 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : listData.length > 0 ? (
              <div className="space-y-2">
                {listData.map((stat: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium text-foreground">
                        {new Date(stat.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-right">
                        <div className="text-muted-foreground text-xs">Page Views</div>
                        <div className="font-semibold text-blue-600 dark:text-blue-400">
                          {stat.views?.toLocaleString() || 0}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-muted-foreground text-xs">Unique Visitors</div>
                        <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {stat.unique?.toLocaleString() || 0}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-muted-foreground text-xs">Bounce Rate</div>
                        <div className="font-semibold">
                          {stat.bounce_rate?.toFixed(1) || 0}%
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <List className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-sm font-medium">No traffic data available</p>
                  <p className="text-xs text-muted-foreground">Data will appear here once visitors start coming to your site</p>
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'hourly' && (
          <div className="h-[350px]">
            <HourlyTrafficChart data={hourlyStats} isLoading={isLoading} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
