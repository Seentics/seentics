'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrafficChart } from './TrafficChart';
import { HourlyTrafficChart } from './HourlyTrafficChart';
import { ComparisonToggle } from './ComparisonToggle';
import { EventAnnotations, EventAnnotation } from './EventAnnotations';
import { cn } from '@/lib/utils';
import { BarChart3, Clock } from 'lucide-react';

interface TrafficOverviewProps {
  dailyStats: any;
  hourlyStats: any;
  previousDailyStats?: any;
  isLoading: boolean;
  className?: string;
  showComparison?: boolean;
  onComparisonToggle?: (enabled: boolean) => void;
  annotations?: EventAnnotation[];
  onAddAnnotation?: (annotation: Omit<EventAnnotation, 'id'>) => void;
  onDeleteAnnotation?: (id: string) => void;
}

export function TrafficOverview({
  dailyStats,
  hourlyStats,
  previousDailyStats,
  isLoading,
  className,
  showComparison = false,
  onComparisonToggle,
  annotations = [],
  onAddAnnotation,
  onDeleteAnnotation,
}: TrafficOverviewProps) {
  const [view, setView] = useState<'chart' | 'hourly'>('chart');

  return (
    <Card className={cn("col-span-full border border-border/60 bg-card shadow-sm overflow-hidden h-[500px]", className)}>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 space-y-0 pb-7 shrink-0">
        <div className="space-y-1">
          <CardTitle className="text-lg font-bold tracking-tight">Traffic Overview</CardTitle>
          <p className="text-xs text-muted-foreground">Visitor volume over time</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {onComparisonToggle && (
            <ComparisonToggle enabled={showComparison} onToggle={onComparisonToggle} />
          )}
          {onAddAnnotation && onDeleteAnnotation && (
            <EventAnnotations
              annotations={annotations}
              onAdd={onAddAnnotation}
              onDelete={onDeleteAnnotation}
            />
          )}
          <Tabs value={view} onValueChange={(v) => setView(v as any)} className="w-auto">
            <TabsList className="grid w-full grid-cols-2 h-9 p-1 rounded">
              <TabsTrigger value="chart" className="text-xs font-medium px-3 gap-1.5 rounded active:bg-background">
                <BarChart3 className="h-3.5 w-3.5" />
                Chart
              </TabsTrigger>
              <TabsTrigger value="hourly" className="text-xs font-medium px-3 gap-1.5 rounded active:bg-background">
                <Clock className="h-3.5 w-3.5" />
                Hourly
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>

      <CardContent className='p-0 pt-0 border-none outline-none'>
        {view === 'chart' && (
          <div className="h-[400px]">
            <TrafficChart
              data={dailyStats}
              isLoading={isLoading}
              previousData={showComparison ? previousDailyStats : undefined}
              showComparison={showComparison}
              annotations={annotations}
            />
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
