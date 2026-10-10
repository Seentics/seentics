'use client';

import { usePathSegment } from '@/lib/path-segment';

import { useState, useMemo } from 'react';
import Link from 'next/link';

import { useRevenueDashboard, formatMoney, type RevenueTransaction } from '@/lib/revenue-analytics';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { StatCards } from '@/components/seentics-ui/StatCards';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GHOST_CONTROL } from '@/components/ui/ghost-control';
import { useRangeDates } from '@/lib/range-dates';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { DataTable, SortableHeader, type ColumnDef } from '@/components/ui/data-table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Banknote, ShoppingCart, Scale, BarChart2, Receipt, ExternalLink, BookOpen,
} from 'lucide-react';


// ─── helpers ──────────────────────────────────────────────────────────────────

import { RevenueDocsSheet } from '@/components/revenue/RevenueDocsSheet';
import { DimTable } from '@/components/revenue/DimTable';
import { RevenueOrdersChart } from '@/components/revenue/RevenueOrdersChart';
import { fmtTime } from '@/features/revenue/format';

export default function RevenuePage() {
  const params = { websiteId: usePathSegment(1) ?? '' };
  const websiteId = params?.websiteId as string;
  const [days, setDays] = useState(30);
  const rangeDates = useRangeDates(days);
  const { data, isLoading } = useRevenueDashboard(websiteId, days);
  const [openTx, setOpenTx] = useState<RevenueTransaction | null>(null);
  const [showDocs, setShowDocs] = useState(false);

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
        tone: 'success' as const,
        subtext: prior
          ? `${prior.change_pct >= 0 ? '+' : ''}${prior.change_pct.toFixed(1)}% vs prior period`
          : undefined,
      },
      {
        label: 'Orders',
        value: summary.orders,
        icon: ShoppingCart,
        tone: 'info' as const,
        subtext: orderChangePct !== undefined
          ? `${orderChangePct >= 0 ? '+' : ''}${orderChangePct.toFixed(1)}% vs prior period`
          : undefined,
      },
      {
        label: 'Avg. Order Value',
        value: formatMoney(summary.aov, cur),
        icon: Scale,
        tone: 'warning' as const,
        subtext: `ARPU ${formatMoney(summary.arpu, cur)}`,
      },
      {
        label: 'Revenue / Session',
        value: formatMoney(summary.revenue_per_session, cur),
        icon: BarChart2,
        tone: 'accent' as const,
        subtext: `${summary.sessions.toLocaleString()} sessions`,
      },
    ];
  }, [summary, cur, prior, orderChangePct]);

  const chartData = useMemo(() =>
    (data?.daily ?? []).map((d) => ({ date: d.date, revenue: d.revenue, orders: d.orders })),
    [data?.daily],
  );

  const txColumns = useMemo<ColumnDef<RevenueTransaction>[]>(() => [
    {
      id: 'time',
      accessorKey: 'occurred_at',
      header: ({ column }) => <SortableHeader column={column}>Time</SortableHeader>,
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-foreground">{fmtTime(row.original.occurred_at)}</p>
          <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground" title={row.original.order_id ?? ''}>
            {row.original.order_id ? `#${row.original.order_id}` : 'No order ID'}
          </p>
        </div>
      ),
    },
    {
      id: 'value',
      accessorKey: 'value',
      header: ({ column }) => <SortableHeader column={column}>Value</SortableHeader>,
      cell: ({ row }) => (
        <span className="text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
          {formatMoney(row.original.value, row.original.currency || cur)}
        </span>
      ),
    },
    {
      id: 'attribution',
      header: 'Attribution',
      cell: ({ row }) => {
        const tx = row.original;
        return (
          <span className="block max-w-[320px] truncate text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{tx.source || 'direct'}</span>
            {tx.medium && tx.medium !== 'none' && <span> / {tx.medium}</span>}
            {tx.campaign && tx.campaign !== '(none)' && <span className="opacity-60"> · {tx.campaign}</span>}
          </span>
        );
      },
    },
    {
      id: 'customer',
      header: 'Customer',
      cell: ({ row }) => (
        <Badge variant="secondary" className="h-5 px-2 text-[10px] font-normal">
          {row.original.user_type === 'new' ? 'New' : row.original.user_type === 'returning' ? 'Returning' : '—'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: '',
      size: 90,
      cell: ({ row }) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 bg-primary/10 px-3 text-xs font-semibold text-primary hover:bg-primary/15 hover:text-primary"
            asChild
          >
            <Link href={`/websites/${websiteId}/revenue/transactions/${encodeURIComponent(row.original.id)}`}>
              Open <ExternalLink className="h-3 w-3 opacity-60" />
            </Link>
          </Button>
        </div>
      ),
    },
  ], [cur, websiteId]);

  if (isLoading) {
    return (
      <div className="w-full max-w-[1440px] mx-auto p-4 md:p-5 lg:px-6 lg:py-5">
        <div className="mb-4 flex justify-between items-start">
          <div className="space-y-2">
            <Skeleton className="h-8 w-28 rounded-lg" />
            <Skeleton className="h-4 w-60 rounded-lg" />
          </div>
          <Skeleton className="h-8 w-32 rounded-lg" />
        </div>
        <StatCards cards={[]} cols={4} isLoading />
        <Skeleton className="h-80 rounded-lg mb-4" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="w-full max-w-[1440px] mx-auto p-4 md:p-5 lg:px-6 lg:py-5">

      {/* ── Header ── */}
      <DashboardPageHeader
        websiteId={websiteId}
        title="Revenue"
        description="Purchase revenue, order economics, and channel attribution."
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs bg-card"
            onClick={() => setShowDocs(true)}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Track revenue
          </Button>

          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className={cn(GHOST_CONTROL, 'h-9 w-auto gap-2 px-3')}>
              <SelectValue>{rangeDates}</SelectValue>
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
      <StatCards cards={topCards} cols={4} isLoading={false} cardClassName="p-3 sm:p-4" />

      <RevenueOrdersChart chartData={chartData} currency={cur} />

      {/* ── Attribution breakdown ── */}
      <Card className="mb-4 overflow-hidden rounded-lg border border-border shadow-sm">
        <Tabs defaultValue="source" className="w-full">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Attribution</h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Where revenue comes from</p>
            </div>
            <TabsList className="h-8 bg-muted/60 p-0.5">
              {([
                ['source', 'Source'],
                ['medium', 'Medium'],
                ['campaign', 'Campaign'],
                ['product', 'Product'],
                ['country', 'Country'],
              ] as const).map(([val, label]) => (
                <TabsTrigger key={val} value={val} className="h-7 px-3 text-xs">
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <CardContent className="p-4">
            <TabsContent value="source" className="mt-0">
              <DimTable icon="source" rows={data?.by_source ?? []} currency={cur} emptyMessage="No source data. Add UTM parameters to your marketing links." />
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
              <DimTable icon="country" rows={data?.by_country ?? []} currency={cur} emptyMessage="No country data yet." />
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {/* ── Recent transactions ── */}
      <DataTable
        className="rounded-lg shadow-sm overflow-hidden [&_tbody_tr]:transition-colors [&_td]:!py-2 [&_th]:!py-2"
        data={data?.recent_transactions ?? []}
        columns={txColumns}
        onRowClick={setOpenTx}
        pageSize={10}
        emptyIcon={<Receipt className="h-8 w-8 opacity-30" />}
        emptyTitle="No transactions yet"
        emptyDescription="Each seentics.track('purchase', { value, currency, order_id }) call appears here."
        toolbarLeft={
          <div>
            <h3 className="font-semibold text-foreground">Recent transactions</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Last 50 purchases — click a row for attribution detail.</p>
          </div>
        }
      />

      <RevenueDocsSheet open={showDocs} onOpenChange={setShowDocs} />

      {/* ── Transaction detail sheet ── */}
      <Sheet open={!!openTx} onOpenChange={(o) => !o && setOpenTx(null)}>
        <SheetContent className="bg-card sm:max-w-md">
          {openTx && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-muted-foreground" />
                  {openTx.order_id ? `Order #${openTx.order_id}` : 'Transaction'}
                </SheetTitle>
                <SheetDescription>{fmtTime(openTx.occurred_at)}</SheetDescription>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
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
                    <div key={label} className="rounded-lg border border-border p-2.5">
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
                        <li key={i} className="flex justify-between text-xs border border-border rounded-lg px-3 py-2">
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
        </SheetContent>
      </Sheet>
    </div>
  );
}
