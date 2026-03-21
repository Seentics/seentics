'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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

const TAB_CLS = 'h-7 text-xs font-medium px-3 gap-1.5 rounded data-[state=inactive]:text-muted-foreground data-[state=inactive]:bg-transparent data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm';

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
    <Card className={cn("col-span-full bg-card shadow-sm overflow-hidden pb-4", className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4 pt-5 px-6 shrink-0 border-b border-border/60">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Traffic Overview</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Visitor volume over time</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
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

          {/* View tabs */}
          <Tabs value={view} onValueChange={(v) => setView(v as any)}>
            <TabsList className="h-8 bg-muted/50 p-0.5 rounded gap-0.5">
              <TabsTrigger value="chart" className={TAB_CLS}>
                <BarChart3 className="h-3.5 w-3.5" />
                Chart
              </TabsTrigger>
              <TabsTrigger value="hourly" className={TAB_CLS}>
                <Clock className="h-3.5 w-3.5" />
                Hourly
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>

      <CardContent className="p-0 pt-2">
        {view === 'chart' && (
          <div className="h-[480px]">
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
          <div className="h-[480px]">
            <HourlyTrafficChart data={hourlyStats} isLoading={isLoading} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
