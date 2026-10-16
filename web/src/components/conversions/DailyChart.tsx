'use client';

/** Accepted and failed conversions per day: one colour for what landed, a muted one for what did not. */
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ConversionSummary } from '@/features/conversions/types';

const dayLabel = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

export function DailyChart({ byDay }: { byDay: ConversionSummary['by_day'] }) {
  const empty = byDay.every((d) => d.accepted === 0 && d.failed === 0);
  return (
    <div className="h-[180px]">
      {empty ? (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Nothing sent in this period yet.</div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={byDay} margin={{ top: 4, right: 4, left: -16, bottom: 0 }} barCategoryGap="25%">
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={dayLabel} interval="preserveStartEnd" minTickGap={24} />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
            <Tooltip
              cursor={{ className: 'fill-muted/40' }}
              content={({ active, label, payload }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="min-w-[140px] rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
                    <p className="mb-1.5 text-[10px] font-medium text-muted-foreground">{dayLabel(String(label))}</p>
                    {payload.map((p) => (
                      <div key={String(p.dataKey)} className="flex justify-between gap-6 py-0.5">
                        <span className="text-muted-foreground">{p.dataKey === 'accepted' ? 'Accepted' : 'Failed'}</span>
                        <span className="font-semibold tabular-nums text-foreground">{Number(p.value ?? 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />
            <Bar dataKey="accepted" stackId="d" className="fill-primary" radius={[0, 0, 0, 0]} maxBarSize={18} />
            <Bar dataKey="failed" stackId="d" className="fill-rose-500/45" radius={[2, 2, 0, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
