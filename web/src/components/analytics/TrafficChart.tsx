'use client';

import React, { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AreaChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { formatNumber } from '@/features/analytics/format';
import type { EventAnnotation } from './EventAnnotations';

interface TrafficChartProps {
  data: any;
  isLoading: boolean;
  title?: string;
  subtitle?: string;
  previousData?: any;
  showComparison?: boolean;
  annotations?: EventAnnotation[];
}

const VISITORS_COLOR = '#2563eb'; // blue — matches app primary
const PAGEVIEWS_COLOR = '#a78bfa'; // soft violet — secondary to visitors, readable in both themes
const PREVIOUS_COLOR = 'hsl(var(--muted-foreground))';

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const date = new Date(label).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });

  // Show pageviews first, then visitors — Plausible order
  const order = ['views', 'unique', 'previous'];
  const sorted = [...payload].sort(
    (a, b) => order.indexOf(a.dataKey) - order.indexOf(b.dataKey)
  );

  const meta: Record<string, string> = {
    views:  'Page Views',
    unique: 'Visitors',
    previous: 'Previous period',
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

function LegendItem({
  color, label, total, dashed, off, onToggle,
}: { color: string; label: string; total?: number; dashed?: boolean; off?: boolean; onToggle?: () => void }) {
  const content = (
    <>
      <span
        className="h-0.5 w-3.5 rounded-full"
        style={dashed ? { backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 3px, transparent 3px 6px)` } : { background: color }}
      />
      <span className="text-muted-foreground">{label}</span>
      {total != null && <span className="font-semibold tabular-nums text-foreground">{formatNumber(total)}</span>}
    </>
  );
  if (!onToggle) return <div className="flex items-center gap-2 text-xs">{content}</div>;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={!off}
      title={off ? `Show ${label}` : `Hide ${label}`}
      className={`flex items-center gap-2 rounded px-1 text-xs transition-opacity hover:opacity-80 ${off ? 'opacity-40 line-through' : ''}`}
    >
      {content}
    </button>
  );
}

export const TrafficChart: React.FC<TrafficChartProps> = ({
  data, isLoading, previousData, showComparison, annotations = [],
}) => {
  // Page views run ~3x visitors, which flattens the visitors line; the legend hides either series.
  const [hidden, setHidden] = useState<{ views?: boolean; unique?: boolean }>({});
  const toggle = (key: 'views' | 'unique') => setHidden((h) => ({ ...h, [key]: !h[key] }));

  if (isLoading) {
    return (
      <div className="h-full flex flex-col justify-end gap-0 px-6 pb-8 pt-6">
        <Skeleton className="w-full rounded-t-2xl" style={{ height: '60%', opacity: 0.15 }} />
      </div>
    );
  }

  const byDate = (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime();
  const current: any[] = [...(data?.daily_stats || [])].sort(byDate);
  const previous: any[] = showComparison ? [...(previousData?.daily_stats || [])].sort(byDate) : [];
  // The previous period is drawn over the current one by position (day 1 over day 1), not by date.
  const chartData = current.map((d, i) => ({ ...d, previous: previous[i]?.unique }));
  const hasPrevious = previous.length > 0;
  const totalViews = current.reduce((sum, d) => sum + (d.views || 0), 0);
  const totalVisitors = current.reduce((sum, d) => sum + (d.unique || 0), 0);

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
    <div className="flex h-full flex-col px-1">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-4 pb-1 pt-1">
        <LegendItem color={VISITORS_COLOR} label="Visitors" total={totalVisitors} off={hidden.unique} onToggle={() => toggle('unique')} />
        <LegendItem color={PAGEVIEWS_COLOR} label="Page views" total={totalViews} off={hidden.views} onToggle={() => toggle('views')} />
        {hasPrevious && <LegendItem color={PREVIOUS_COLOR} label="Previous period" dashed />}
      </div>
      <div className="min-h-0 flex-1">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 12, right: 24, left: 12, bottom: 0 }}>
          <defs>
            <linearGradient id="fillViews" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={PAGEVIEWS_COLOR} stopOpacity={0.08} />
              <stop offset="100%" stopColor={PAGEVIEWS_COLOR} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="fillVisitors" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={VISITORS_COLOR} stopOpacity={0.35} />
              <stop offset="100%" stopColor={VISITORS_COLOR} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 4" strokeOpacity={0.8} />

          <XAxis
            dataKey="date"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
            interval="preserveStartEnd"
            minTickGap={48}
            dy={6}
          />
          <YAxis
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => formatNumber(v)}
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
            width={38}
            tickCount={5}
            domain={[0, 'auto']}
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
            hide={hidden.views}
            dot={false}
            activeDot={{ r: 4, fill: PAGEVIEWS_COLOR, stroke: 'hsl(var(--background))', strokeWidth: 2 }}
          />

          {/* Unique Visitors — on top */}
          <Area
            type="monotone"
            dataKey="unique"
            stroke={VISITORS_COLOR}
            strokeWidth={2.5}
            fill="url(#fillVisitors)"
            hide={hidden.unique}
            dot={false}
            activeDot={{ r: 5, fill: VISITORS_COLOR, stroke: 'hsl(var(--background))', strokeWidth: 2 }}
          />

          {hasPrevious && (
            <Line
              type="monotone"
              dataKey="previous"
              stroke={PREVIOUS_COLOR}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              strokeOpacity={0.7}
              dot={false}
              activeDot={{ r: 3, fill: PREVIOUS_COLOR, stroke: 'hsl(var(--background))', strokeWidth: 2 }}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
};
