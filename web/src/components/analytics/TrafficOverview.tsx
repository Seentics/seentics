'use client';

import { useControllableState } from '@/hooks/useControllableState';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrafficChart } from './TrafficChart';
import { HourlyTrafficChart } from './HourlyTrafficChart';
import { ComparisonToggle } from './ComparisonToggle';
import { EventAnnotations, EventAnnotation } from './EventAnnotations';
import { cn } from '@/lib/utils';
import { BarChart3, Clock } from 'lucide-react';

export interface TrafficOverviewProps {
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
  /** Controlled for deterministic embeds, recordings, and content-engine scenes. */
  view?: 'chart' | 'hourly';
  onViewChange?: (view: 'chart' | 'hourly') => void;
}

const TAB_CLS = 'h-7 text-xs font-medium px-3 gap-1.5 rounded-lg data-[state=inactive]:text-muted-foreground data-[state=inactive]:bg-transparent data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm';

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
  view,
  onViewChange,
}: TrafficOverviewProps) {
  const [activeView, handleViewChange] = useControllableState({
    value: view,
    defaultValue: 'chart' as const,
    onChange: onViewChange,
  });

  return (
    <Card className={cn("col-span-full surface overflow-hidden pb-2", className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 px-4 py-3 shrink-0 border-b border-border">
        <h2 className="text-sm font-semibold tracking-tight">Traffic Overview</h2>

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
          <Tabs value={activeView} onValueChange={(value) => handleViewChange(value as 'chart' | 'hourly')}>
            <TabsList className="h-8 bg-muted p-0.5 rounded-lg gap-0.5">
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
        {activeView === 'chart' && (
          <div className="h-[380px]">
            <TrafficChart
              data={dailyStats}
              isLoading={isLoading}
              previousData={showComparison ? previousDailyStats : undefined}
              showComparison={showComparison}
              annotations={annotations}
            />
          </div>
        )}
        {activeView === 'hourly' && (
          <div className="h-[380px]">
            <HourlyTrafficChart data={hourlyStats} isLoading={isLoading} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
