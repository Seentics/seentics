'use client';

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
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

const VISITORS_COLOR = '#2563eb'; // blue — matches app primary
const PAGEVIEWS_COLOR = '#93c5fd'; // lighter blue — secondary

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const date = new Date(label).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });

  // Show pageviews first, then visitors — Plausible order
  const order = ['views', 'unique'];
  const sorted = [...payload].sort(
    (a, b) => order.indexOf(a.dataKey) - order.indexOf(b.dataKey)
  );

  const meta: Record<string, string> = {
    views:  'Page Views',
    unique: 'Visitors',
  };

  return (
    <div className="bg-popover border border-border rounded-lg shadow-xl px-3.5 py-3 text-xs min-w-[160px]">
      <p className="text-[11px] font-medium text-muted-foreground mb-2.5 pb-2 border-b border-border">{date}</p>
      {sorted.map((entry: any) => {
        if (entry.value == null) return null;
        return (
          <div key={entry.dataKey} className="flex items-center justify-between gap-8 py-0.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: entry.color }} />
              <span className="text-muted-foreground">{meta[entry.dataKey] ?? entry.dataKey}</span>
            </div>
            <span className="font-semibold tabular-nums text-foreground">{formatNumber(entry.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

function TooltipCursor({ points, width, height }: any) {
  if (!points?.length) return null;
  const x = points[0].x;
  return (
    <line
      x1={x} y1={0} x2={x} y2={height}
      stroke="hsl(var(--border))"
      strokeWidth={1}
      strokeDasharray="4 3"
    />
  );
}

export const TrafficChart: React.FC<TrafficChartProps> = ({
  data, isLoading, annotations = [],
}) => {
  if (isLoading) {
    return (
      <div className="h-full flex flex-col justify-end gap-0 px-6 pb-8 pt-6">
        <Skeleton className="w-full rounded-lg-t-2xl" style={{ height: '60%', opacity: 0.15 }} />
      </div>
    );
  }

  const chartData = (data?.daily_stats || []).sort((a: any, b: any) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  if (chartData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">No traffic data yet</p>
          <p className="text-xs text-muted-foreground/50 mt-1">Data will appear once visitors arrive</p>
        </div>
      </div>
    );
  }

  const chartDateStrings = new Set(chartData.map((d: any) => new Date(d.date).toISOString().split('T')[0]));
  const matchingAnnotations = annotations.filter(a =>
    chartDateStrings.has(new Date(a.date).toISOString().split('T')[0])
  );

  return (
    <div className="h-full px-1">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 16, right: 24, left: 12, bottom: 0 }}>
          <defs>
            <linearGradient id="fillViews" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={PAGEVIEWS_COLOR} stopOpacity={0.3} />
              <stop offset="100%" stopColor={PAGEVIEWS_COLOR} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="fillVisitors" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={VISITORS_COLOR} stopOpacity={0.2} />
              <stop offset="100%" stopColor={VISITORS_COLOR} stopOpacity={0} />
            </linearGradient>
          </defs>

          <XAxis
            dataKey="date"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
            interval="preserveStartEnd"
            dy={6}
          />
          <YAxis
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => formatNumber(v)}
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
            width={38}
            tickCount={4}
          />

          <Tooltip
            content={<CustomTooltip />}
            cursor={<TooltipCursor />}
          />

          {matchingAnnotations.map(annotation => (
            <ReferenceLine
              key={annotation.id}
              x={new Date(annotation.date).toISOString().split('T')[0]}
              stroke={annotation.color || '#2563eb'}
              strokeDasharray="4 3"
              strokeWidth={1.5}
              label={{ value: annotation.title, position: 'top', fill: annotation.color || '#2563eb', fontSize: 10 }}
            />
          ))}

          {/* Page Views — rendered first so it's behind visitors */}
          <Area
            type="monotone"
            dataKey="views"
            stroke={PAGEVIEWS_COLOR}
            strokeWidth={1.5}
            fill="url(#fillViews)"
            dot={false}
            activeDot={{ r: 4, fill: PAGEVIEWS_COLOR, stroke: 'hsl(var(--background))', strokeWidth: 2 }}
          />

          {/* Unique Visitors — on top */}
          <Area
            type="monotone"
            dataKey="unique"
            stroke={VISITORS_COLOR}
            strokeWidth={2}
            fill="url(#fillVisitors)"
            dot={false}
            activeDot={{ r: 4, fill: VISITORS_COLOR, stroke: 'hsl(var(--background))', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
