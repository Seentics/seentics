'use client';

import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';
import type { DisplayBlock } from '@/features/ai/types';

type Props = { block: Extract<DisplayBlock, { kind: 'timeseries' }>; className?: string };

/** Palette by position, so a two-series answer is readable without the tool naming colours. */
const STROKES = ['hsl(var(--primary))', '#0ea5e9', '#10b981', '#f59e0b'];

/** A series over time. Fixed height — the chat column decides the width. */
export function TimeseriesBlock({ block, className }: Props) {
  if (!block.rows.length || !block.series.length) return null;

  return (
    <div className={cn('h-56 w-full rounded-xl border border-border bg-card p-3', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={block.rows} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
          <defs>
            {block.series.map((s, i) => (
              <linearGradient key={s.key} id={`ai-grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={STROKES[i % STROKES.length]} stopOpacity={0.25} />
                <stop offset="100%" stopColor={STROKES[i % STROKES.length]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
          <XAxis dataKey={block.xKey} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 12,
              fontSize: 12,
            }}
          />
          {block.series.map((s, i) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={STROKES[i % STROKES.length]}
              fill={`url(#ai-grad-${s.key})`}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
