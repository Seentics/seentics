'use client';

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  ReferenceLine,
} from 'recharts';
import { formatNumber } from '@/lib/analytics-api';
import type { EventAnnotation } from './EventAnnotations';

interface TrafficChartProps {
  data: any;
  isLoading: boolean;
  showHeader?: boolean;
  title?: string;
  subtitle?: string;
  previousData?: any;
  showComparison?: boolean;
  annotations?: EventAnnotation[];
}

const primaryChartColor = '#325cb6ff'; // blue-500
const secondaryChartColor = '#10b981'; // emerald-500
const prevPrimaryColor = '#93a5cf'; // muted blue for previous period
const prevSecondaryColor = '#6ee7b7'; // muted green for previous period

const commonTooltipProps = {
  contentStyle: {
    backgroundColor: 'hsl(var(--background))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
    padding: '12px'
  },
  itemStyle: { color: 'hsl(var(--foreground))' },
  labelStyle: { color: 'hsl(var(--muted-foreground))' },
  cursor: { fill: 'hsl(var(--muted) / 0.1)' }
};

export const TrafficChart: React.FC<TrafficChartProps> = ({
  data,
  isLoading,
  showHeader = false,
  title = 'Traffic Overview',
  subtitle = 'Page views and unique visitors over time',
  previousData,
  showComparison = false,
  annotations = [],
}) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Sort data chronologically (oldest to newest) for proper chart display
  const chartData = (data?.daily_stats || []).sort((a: any, b: any) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Merge previous period data by index alignment (day 1 vs day 1)
  const prevStats = (previousData?.daily_stats || [])
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-chartData.length); // Ensure same length as current period

  const mergedData = chartData.map((item: any, index: number) => ({
    ...item,
    prevViews: prevStats[index]?.views ?? undefined,
    prevUnique: prevStats[index]?.unique ?? undefined,
  }));

  if (chartData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-sm font-medium">No traffic data available</p>
          <p className="text-xs text-muted-foreground">Data will appear here once visitors start coming to your site</p>
        </div>
      </div>
    );
  }

  // Find annotation dates that match chart dates
  const chartDateStrings = new Set(chartData.map((d: any) => new Date(d.date).toISOString().split('T')[0]));
  const matchingAnnotations = annotations.filter(a => {
    const aDate = new Date(a.date).toISOString().split('T')[0];
    return chartDateStrings.has(aDate);
  });

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        {showHeader && (
          <div>
            <h3 className="text-lg font-medium text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          </div>
        )}
        <div className="flex items-center space-x-6 text-sm ml-auto mx-12">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-muted-foreground">Page Views</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-muted-foreground">Unique Visitors</span>
          </div>
          {showComparison && prevStats.length > 0 && (
            <div className="flex items-center space-x-2">
              <div className="w-3 h-0.5 border-t-2 border-dashed border-muted-foreground/40" />
              <span className="text-muted-foreground">Previous Period</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={mergedData} margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
          <defs>
            <linearGradient id="mainViews" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={primaryChartColor} stopOpacity={0.2}/>
              <stop offset="95%" stopColor={primaryChartColor} stopOpacity={0.02}/>
            </linearGradient>
            <linearGradient id="mainVisitors" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={secondaryChartColor} stopOpacity={0.2}/>
              <stop offset="95%" stopColor={secondaryChartColor} stopOpacity={0.02}/>
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            vertical={false}
            opacity={0.2}
          />
          <XAxis
            dataKey="date"
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric'
            })}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => formatNumber(value)}
          />
          <Tooltip
            {...commonTooltipProps}
            labelFormatter={(date) => new Date(date).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric'
            })}
            formatter={(value: any, name: string) => {
              if (value === undefined) return [null, null];
              const labelMap: Record<string, string> = {
                pageViews: 'Page Views',
                uniqueVisitors: 'Unique Visitors',
                prevPageViews: 'Prev. Page Views',
                prevUniqueVisitors: 'Prev. Unique Visitors',
              };
              return [formatNumber(value), labelMap[name] || name];
            }}
          />

          {/* Annotation reference lines */}
          {matchingAnnotations.map((annotation) => (
            <ReferenceLine
              key={annotation.id}
              x={new Date(annotation.date).toISOString().split('T')[0]}
              stroke={annotation.color || '#8b5cf6'}
              strokeDasharray="3 3"
              strokeWidth={2}
              label={{
                value: annotation.title,
                position: 'top',
                fill: annotation.color || '#8b5cf6',
                fontSize: 10,
                fontWeight: 600,
              }}
            />
          ))}

          {/* Previous period comparison (dashed, behind current) */}
          {showComparison && prevStats.length > 0 && (
            <>
              <Area
                type="monotone"
                dataKey="prevViews"
                stroke={prevPrimaryColor}
                strokeWidth={1.5}
                strokeDasharray="5 5"
                fillOpacity={0}
                fill="none"
                name="prevPageViews"
                connectNulls={false}
              />
              <Area
                type="monotone"
                dataKey="prevUnique"
                stroke={prevSecondaryColor}
                strokeWidth={1.5}
                strokeDasharray="5 5"
                fillOpacity={0}
                fill="none"
                name="prevUniqueVisitors"
                connectNulls={false}
              />
            </>
          )}

          {/* Current period (solid, on top) */}
          <Area
            type="monotone"
            dataKey="views"
            stroke={primaryChartColor}
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#mainViews)"
            name="pageViews"
          />
          <Area
            type="monotone"
            dataKey="unique"
            stroke={secondaryChartColor}
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#mainVisitors)"
            name="uniqueVisitors"
          />
        </AreaChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
};
