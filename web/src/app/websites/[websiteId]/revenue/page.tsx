'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  useRevenueDashboard,
  formatMoney,
  type RevenueByRow,
  type RevenueTransaction,
} from '@/lib/revenue-analytics';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { StatCards } from '@/components/seentics-ui/StatCards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Banknote, ShoppingCart, Scale, BarChart2, Receipt, ExternalLink,
} from 'lucide-react';
import {
  ComposedChart, Area, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { cn } from '@/lib/utils';

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
  catch { return iso; }
}

function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return iso; }
}

function fmtK(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

// ─── DimTable ─────────────────────────────────────────────────────────────────

function DimTable({ rows, currency, emptyMessage }: {
  rows: RevenueByRow[]; currency: string; emptyMessage: string;
}) {
  if (!rows.length) {
    return <div className="py-10 text-center text-sm text-muted-foreground">{emptyMessage}</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/40 text-left">
            <th className="py-2.5 pr-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Name</th>
            <th className="py-2.5 pr-4 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Revenue</th>
            <th className="py-2.5 pr-4 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Orders</th>
            <th className="py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-[140px]">Share</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors">
              <td className="py-2.5 pr-4 font-medium text-foreground max-w-[180px] truncate" title={r.name}>{r.name}</td>
              <td className="py-2.5 pr-4 text-right tabular-nums font-semibold text-foreground">{formatMoney(r.revenue, currency)}</td>
              <td className="py-2.5 pr-4 text-right tabular-nums text-muted-foreground">{r.orders.toLocaleString()}</td>
              <td className="py-2.5">
                <div className="flex items-center justify-end gap-2">
                  <span className="text-xs text-muted-foreground w-9 text-right tabular-nums">{r.share_pct.toFixed(1)}%</span>
                  <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary/70 rounded-full" style={{ width: `${Math.min(100, r.share_pct)}%` }} />
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RevenuePage() {
  const params = useParams();
  const websiteId = params?.websiteId as string;
  const [days, setDays] = useState(30);
  const { data, isLoading } = useRevenueDashboard(websiteId, days);
  const [openTx, setOpenTx] = useState<RevenueTransaction | null>(null);

  const summary = data?.summary;
  const cur = summary?.currency ?? 'USD';
  const prior = summary?.prior_period;

  const orderChangePct = prior && prior.orders > 0 && summary
    ? Math.round(((summary.orders - prior.orders) / prior.orders) * 1000) / 10
    : undefined;

  // Exactly 4 stat cards — uses the shared StatCards component like every other sub-page
  const topCards = useMemo(() => {
    if (!summary) return [];
    return [
      {
        label: 'Total Revenue',
        value: formatMoney(summary.total_revenue, cur),
        icon: Banknote,
        iconColor: 'text-emerald-600',
        subtext: prior
          ? `${prior.change_pct >= 0 ? '+' : ''}${prior.change_pct.toFixed(1)}% vs prior period`
          : undefined,
      },
      {
        label: 'Orders',
        value: summary.orders,
        icon: ShoppingCart,
        iconColor: 'text-primary',
        subtext: orderChangePct !== undefined
          ? `${orderChangePct >= 0 ? '+' : ''}${orderChangePct.toFixed(1)}% vs prior period`
          : undefined,
      },
      {
        label: 'Avg. Order Value',
        value: formatMoney(summary.aov, cur),
        icon: Scale,
        iconColor: 'text-amber-600',
        subtext: `ARPU ${formatMoney(summary.arpu, cur)}`,
      },
      {
        label: 'Revenue / Session',
        value: formatMoney(summary.revenue_per_session, cur),
        icon: BarChart2,
        iconColor: 'text-sky-600',
        subtext: `${summary.sessions.toLocaleString()} sessions`,
      },
    ];
  }, [summary, cur, prior, orderChangePct]);

  const chartData = useMemo(() =>
    (data?.daily ?? []).map((d) => ({ date: d.date, revenue: d.revenue, orders: d.orders })),
    [data?.daily],
  );

  if (isLoading) {
    return (
      <div className="w-full max-w-[1440px] mx-auto p-4 md:p-6 lg:p-8">
        <div className="mb-8 flex justify-between items-start">
          <div className="space-y-2">
            <Skeleton className="h-8 w-28 rounded" />
            <Skeleton className="h-4 w-60 rounded" />
          </div>
          <Skeleton className="h-8 w-32 rounded" />
        </div>
        <StatCards cards={[]} cols={4} isLoading />
        <Skeleton className="h-80 rounded-lg mb-4" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="w-full max-w-[1440px] mx-auto p-4 md:p-6 lg:p-8">

      {/* ── Header ── */}
      <DashboardPageHeader
        title="Revenue"
        description="Purchase revenue, order economics, and channel attribution."
      >
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] font-semibold uppercase tracking-wide h-8 px-3',
              data?.data_quality === 'full'
                ? 'border-emerald-500/40 text-emerald-600 bg-emerald-500/5'
                : data?.data_quality === 'partial'
                  ? 'border-amber-500/40 text-amber-600 bg-amber-500/5'
                  : 'border-border text-muted-foreground',
            )}
          >
            {data?.data_quality === 'full' ? 'Full data' : data?.data_quality === 'partial' ? 'Partial data' : 'No data'}
          </Badge>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[7, 14, 30, 90].map((d) => (
                <SelectItem key={d} value={String(d)} className="text-xs">Last {d} days</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </DashboardPageHeader>

      {/* ── 4 stat cards (same StatCards component as Funnels, Events pages) ── */}
      <StatCards cards={topCards} cols={4} isLoading={false} />

      {/* ── Revenue & orders chart ── */}
      <Card className="border border-border/60 mb-6">
        <CardHeader className="pb-2 border-b border-border/40">
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
                Call <code className="font-mono bg-muted px-1 rounded">seentics.track(&apos;purchase&apos;, &#123; value, currency &#125;)</code> from your checkout
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
                      <div className="bg-popover border border-border/60 rounded-lg shadow-lg px-3 py-2 text-xs min-w-[160px]">
                        <p className="text-[10px] font-medium text-muted-foreground mb-1.5">{label ? fmtDate(String(label)) : ''}</p>
                        {payload.map((p, i) => (
                          <div key={i} className="flex justify-between gap-6 py-0.5">
                            <span className="text-muted-foreground capitalize">{String(p.name ?? '')}</span>
                            <span className="font-semibold tabular-nums text-foreground">
                              {p.dataKey === 'revenue' ? formatMoney(Number(p.value ?? 0), cur) : Number(p.value ?? 0).toLocaleString()}
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

      {/* ── Attribution breakdown ── */}
      <h3 className="text-sm font-semibold text-foreground mb-2">Attribution breakdown</h3>
      <Card className="border border-border/60 mb-8">
        <CardContent className="p-0">
          <Tabs defaultValue="source" className="w-full">
            <div className="border-b border-border/50 px-4 pt-2">
              <TabsList className="h-9 w-full justify-start overflow-x-auto bg-transparent gap-0">
                {([
                  ['source', 'Source / referrer'],
                  ['medium', 'Medium'],
                  ['campaign', 'Campaign'],
                  ['product', 'Product / SKU'],
                  ['country', 'Country'],
                ] as const).map(([val, label]) => (
                  <TabsTrigger
                    key={val}
                    value={val}
                    className="text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                  >
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            <div className="p-4">
              <TabsContent value="source" className="mt-0">
                <DimTable rows={data?.by_source ?? []} currency={cur} emptyMessage="No source data. Add UTM parameters to your marketing links." />
              </TabsContent>
              <TabsContent value="medium" className="mt-0">
                <DimTable rows={data?.by_medium ?? []} currency={cur} emptyMessage="No medium data yet." />
              </TabsContent>
              <TabsContent value="campaign" className="mt-0">
                <DimTable rows={data?.by_campaign ?? []} currency={cur} emptyMessage="No campaign data. Add utm_campaign to your links." />
              </TabsContent>
              <TabsContent value="product" className="mt-0">
                <DimTable rows={data?.by_product ?? []} currency={cur} emptyMessage="No product data. Add product_name to your purchase events." />
              </TabsContent>
              <TabsContent value="country" className="mt-0">
                <DimTable rows={data?.by_country ?? []} currency={cur} emptyMessage="No country data yet." />
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {/* ── Recent transactions ── */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">Recent transactions</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">Last 50 purchases — click a row for full attribution detail.</p>
      </div>
      <Card className="border border-border/60">
        <CardContent className="p-0">
          {(!data?.recent_transactions || data.recent_transactions.length === 0) ? (
            <div className="py-14 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
              <Receipt className="h-8 w-8 opacity-30" />
              <p>No transactions yet.</p>
              <p className="text-xs">
                Each <code className="font-mono bg-muted px-1 rounded">seentics.track(&apos;purchase&apos;, &#123; value, currency, order_id &#125;)</code> call appears here.
              </p>
            </div>
          ) : (
            <>
              <div className="hidden md:grid grid-cols-[1fr_130px_110px_1fr_90px_80px] gap-2 px-5 py-2.5 bg-muted/20 border-b border-border/40 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                <span>Time</span>
                <span>Order ID</span>
                <span className="text-right">Value</span>
                <span>Attribution</span>
                <span>Customer</span>
                <span className="text-right">Details</span>
              </div>
              <ul>
                {data.recent_transactions.map((tx) => (
                  <li
                    key={tx.id}
                    onClick={() => setOpenTx(tx)}
                    className="border-b border-border/30 last:border-0 px-5 py-3.5 flex flex-col md:grid md:grid-cols-[1fr_130px_110px_1fr_90px_80px] gap-1 md:gap-2 md:items-center hover:bg-muted/20 cursor-pointer transition-colors"
                  >
                    <span className="text-xs text-muted-foreground">{fmtTime(tx.occurred_at)}</span>
                    <span className="text-xs font-mono truncate" title={tx.order_id ?? ''}>{tx.order_id ?? '—'}</span>
                    <span className="text-sm font-semibold text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                      {formatMoney(tx.value, tx.currency || cur)}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      <span className="font-medium text-foreground">{tx.source || 'direct'}</span>
                      {tx.medium && tx.medium !== 'none' && <span> / {tx.medium}</span>}
                      {tx.campaign && tx.campaign !== '(none)' && <span className="opacity-60"> · {tx.campaign}</span>}
                    </span>
                    <span>
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        {tx.user_type === 'new' ? 'New' : tx.user_type === 'returning' ? 'Returning' : '—'}
                      </Badge>
                    </span>
                    <div className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                        <Link href={`/websites/${websiteId}/revenue/transactions/${encodeURIComponent(tx.id)}`}>
                          Open <ExternalLink className="h-3 w-3 ml-1 opacity-50" />
                        </Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Transaction detail dialog ── */}
      <Dialog open={!!openTx} onOpenChange={() => setOpenTx(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto border border-border/60 bg-card rounded-xl shadow-xl p-0 gap-0">
          {openTx && (
            <>
              <DialogHeader className="p-5 pb-3 border-b border-border/60">
                <DialogTitle className="text-base font-semibold tracking-tight flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-muted-foreground" />
                  {openTx.order_id ? `Order #${openTx.order_id}` : 'Transaction'}
                </DialogTitle>
                <DialogDescription className="text-xs">{fmtTime(openTx.occurred_at)}</DialogDescription>
              </DialogHeader>
              <div className="p-5 space-y-4 text-sm">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-2xl font-bold tabular-nums">{formatMoney(openTx.value, openTx.currency || cur)}</span>
                  {openTx.country && <Badge variant="outline">{openTx.country}</Badge>}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { label: 'Source', value: openTx.source ?? '—' },
                    { label: 'Medium', value: openTx.medium ?? '—' },
                    { label: 'Campaign', value: openTx.campaign ?? '—' },
                    { label: 'Customer', value: openTx.user_type === 'new' ? 'New' : openTx.user_type === 'returning' ? 'Returning' : '—' },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-md border border-border/50 p-2.5">
                      <p className="text-muted-foreground">{label}</p>
                      <p className="font-medium mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>
                {openTx.product_name && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Line items</p>
                    <ul className="space-y-1.5">
                      {(openTx.items && openTx.items.length > 0
                        ? openTx.items
                        : [{ sku: '', name: openTx.product_name, qty: 1, price: openTx.value }]
                      ).map((it, i) => (
                        <li key={i} className="flex justify-between text-xs border border-border/40 rounded-md px-3 py-2">
                          <span>
                            <span className="font-medium">{it.name}</span>
                            {it.sku && <span className="text-muted-foreground ml-1 font-mono">({it.sku})</span>}
                            <span className="text-muted-foreground"> ×{it.qty}</span>
                          </span>
                          <span className="tabular-nums font-medium">{formatMoney(it.price, openTx.currency || cur)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <Button className="w-full" variant="outline" asChild>
                  <Link href={`/websites/${websiteId}/revenue/transactions/${encodeURIComponent(openTx.id)}`}>
                    Open full page <ExternalLink className="h-3.5 w-3.5 ml-2 opacity-50" />
                  </Link>
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
