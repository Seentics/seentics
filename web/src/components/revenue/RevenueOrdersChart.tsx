'use client';

import { useState, useMemo } from 'react';



import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

import { Banknote } from 'lucide-react';
import {
  ComposedChart, Area, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { cn } from '@/lib/utils';
import { fmtDate, fmtK } from '@/features/revenue/format';
import { formatMoney } from '@/lib/revenue-analytics';

export interface RevenueOrdersChartProps {
  /** One point per day: revenue, orders and the raw ISO date. */
  chartData: { date: string; revenue: number; orders: number }[];
  currency?: string;
  className?: string;
}

/**
 * Daily revenue and orders, with the empty state that tells someone how to start
 * sending purchases.
 *
 * The empty state is the reason this is a component rather than a chart call: it
 * carries setup instructions, and those belong next to the chart that has nothing to
 * draw rather than in whichever page happens to mount it.
 */
export function RevenueOrdersChart({ chartData, currency, className }: RevenueOrdersChartProps) {
  return (
    <Card className={cn('mb-6 rounded-lg border border-border', className)}>
      <CardHeader className=" border-b border-border">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-sm font-semibold">Revenue & orders (daily)</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Gross purchase value. Refunds shown in summary when tracked.</p>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-[2px] rounded-full bg-primary inline-block" />
              Revenue
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-2 rounded-sm bg-sky-500/50 inline-block" />
              Orders
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 h-[280px]">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center flex-col gap-2 text-center">
            <Banknote className="h-8 w-8 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">No revenue data yet</p>
            <p className="text-xs text-muted-foreground/60">
              Call <code className="font-mono bg-muted px-1 rounded-lg">seentics.track(&apos;purchase&apos;, &#123; value, currency &#125;)</code> from your checkout
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={fmtDate}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="rev"
                orientation="left"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(n) => `$${fmtK(n)}`}
                width={52}
              />
              <YAxis
                yAxisId="ord"
                orientation="right"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={fmtK}
                width={36}
              />
              <Tooltip
                content={({ active, label, payload }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="bg-popover border border-border rounded-lg shadow-lg px-3 py-2 text-xs min-w-[160px]">
                      <p className="text-[10px] font-medium text-muted-foreground mb-1.5">{label ? fmtDate(String(label)) : ''}</p>
                      {payload.map((p, i) => (
                        <div key={i} className="flex justify-between gap-6 py-0.5">
                          <span className="text-muted-foreground capitalize">{String(p.name ?? '')}</span>
                          <span className="font-semibold tabular-nums text-foreground">
                            {p.dataKey === 'revenue' ? formatMoney(Number(p.value ?? 0), currency) : Number(p.value ?? 0).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              <Area
                yAxisId="rev"
                type="monotone"
                name="Revenue"
                dataKey="revenue"
                stroke="hsl(var(--primary))"
                fill="url(#revenueGrad)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
              <Bar
                yAxisId="ord"
                name="Orders"
                dataKey="orders"
                className="fill-sky-500/30"
                radius={[2, 2, 0, 0]}
                maxBarSize={14}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
