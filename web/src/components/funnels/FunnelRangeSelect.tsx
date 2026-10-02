'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * The ranges a funnel report offers. A funnel follows each visitor through raw events,
 * which are kept 31 days (core db/sql/038), and the API caps a report at 31 — so these
 * are exact across the whole range. Every other report reads the daily rollups and
 * keeps its longer ranges.
 */
export const FUNNEL_RANGES = [
  { days: 1, label: 'Last 24 hours', short: '24h' },
  { days: 7, label: 'Last 7 days', short: '7d' },
  { days: 31, label: 'Last 31 days', short: '31d' },
] as const;

export const DEFAULT_FUNNEL_DAYS = 31;

export function funnelRangeLabel(days: number): string {
  return FUNNEL_RANGES.find((r) => r.days === days)?.label ?? `Last ${days} days`;
}

export function FunnelRangeSelect({ value, onChange }: { value: number; onChange: (days: number) => void }) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className="w-[140px] h-8 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {FUNNEL_RANGES.map((r) => (
          <SelectItem key={r.days} value={String(r.days)} className="text-xs">{r.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
