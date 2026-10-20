'use client';

import { usePathSegment } from '@/lib/path-segment';

import { useState, useMemo } from 'react';
import Link from 'next/link';

import { useRevenueDashboard, formatMoney, type RevenueTransaction } from '@/lib/revenue-analytics';
import { ReportPage } from '@/components/ui/linear-list';
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
import { Receipt, ExternalLink, BookOpen } from 'lucide-react';


// ─── helpers ──────────────────────────────────────────────────────────────────

import { RevenueDocsSheet } from '@/components/revenue/RevenueDocsSheet';
import { DimTable } from '@/components/revenue/DimTable';
import { RevenueOrdersChart } from '@/components/revenue/RevenueOrdersChart';
import { fmtTime } from '@/features/revenue/format';
import { useLocale, useT } from '@/lib/i18n';

export default function RevenuePage() {
  const t = useT().revenue.page;
  const { locale } = useLocale();
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
        label: t.totalRevenue,
        value: formatMoney(summary.total_revenue, cur),
        subtext: prior
          ? t.vsPrior(`${prior.change_pct >= 0 ? '+' : ''}${prior.change_pct.toFixed(1)}`)
          : undefined,
      },
      {
        label: t.orders,
        value: summary.orders,
        subtext: orderChangePct !== undefined
          ? t.vsPrior(`${orderChangePct >= 0 ? '+' : ''}${orderChangePct.toFixed(1)}`)
          : undefined,
      },
      {
        label: t.aov,
        value: formatMoney(summary.aov, cur),
        subtext: t.arpu(formatMoney(summary.arpu, cur)),
      },
      {
        label: t.revenuePerSession,
        value: formatMoney(summary.revenue_per_session, cur),
        subtext: t.sessions(summary.sessions.toLocaleString()),
      },
    ];
  }, [summary, cur, prior, orderChangePct, t]);

  const chartData = useMemo(() =>
    (data?.daily ?? []).map((d) => ({ date: d.date, revenue: d.revenue, orders: d.orders })),
    [data?.daily],
  );

  const txColumns = useMemo<ColumnDef<RevenueTransaction>[]>(() => [
    {
      id: 'time',
      accessorKey: 'occurred_at',
      header: ({ column }) => <SortableHeader column={column}>{t.time}</SortableHeader>,
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-foreground">{fmtTime(row.original.occurred_at, locale)}</p>
          <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground" title={row.original.order_id ?? ''}>
            {row.original.order_id ? `#${row.original.order_id}` : t.noOrderId}
          </p>
        </div>
      ),
    },
    {
      id: 'value',
      accessorKey: 'value',
      header: ({ column }) => <SortableHeader column={column}>{t.value}</SortableHeader>,
      cell: ({ row }) => (
        <span className="text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
          {formatMoney(row.original.value, row.original.currency || cur)}
        </span>
      ),
    },
    {
      id: 'attribution',
      header: t.attribution,
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
      header: t.customer,
      cell: ({ row }) => (
        <Badge variant="secondary" className="h-5 px-2 text-[10px] font-normal">
          {row.original.user_type === 'new' ? t.newCustomer : row.original.user_type === 'returning' ? t.returning : '—'}
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
              {t.open} <ExternalLink className="h-3 w-3 opacity-60" />
            </Link>
          </Button>
        </div>
      ),
    },
  ], [cur, websiteId, t, locale]);

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
    <ReportPage
      title={t.title}
      description={t.description}
      websiteId={websiteId}
      actions={<>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs bg-card"
            onClick={() => setShowDocs(true)}
          >
            <BookOpen className="h-3.5 w-3.5" />
            {t.trackRevenue}
          </Button>

          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className={cn(GHOST_CONTROL, 'h-9 w-auto gap-2 px-3')}>
              <SelectValue>{rangeDates}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {[7, 14, 30, 90].map((d) => (
                <SelectItem key={d} value={String(d)} className="text-xs">{t.lastDays(d)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </>}
    >

      {/* ── 4 stat cards (same StatCards component as Funnels, Events pages) ── */}
      <StatCards cards={topCards} cols={4} isLoading={false} />

      <RevenueOrdersChart chartData={chartData} currency={cur} />

      {/* ── Attribution breakdown ── */}
      <Card className="mb-4 overflow-hidden rounded-lg border border-border shadow-sm">
        <Tabs defaultValue="source" className="w-full">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">{t.attribution}</h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{t.attributionHint}</p>
            </div>
            <TabsList className="h-8 max-w-full justify-start overflow-x-auto bg-muted/60 p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {(['source', 'medium', 'campaign', 'product', 'country'] as const).map((val) => (
                <TabsTrigger key={val} value={val} className="h-7 px-3 text-xs">
                  {t.dims[val]}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <CardContent className="p-4">
            <TabsContent value="source" className="mt-0">
              <DimTable icon="source" rows={data?.by_source ?? []} currency={cur} emptyMessage={t.emptySource} />
            </TabsContent>
            <TabsContent value="medium" className="mt-0">
              <DimTable rows={data?.by_medium ?? []} currency={cur} emptyMessage={t.emptyMedium} />
            </TabsContent>
            <TabsContent value="campaign" className="mt-0">
              <DimTable rows={data?.by_campaign ?? []} currency={cur} emptyMessage={t.emptyCampaign} />
            </TabsContent>
            <TabsContent value="product" className="mt-0">
              <DimTable rows={data?.by_product ?? []} currency={cur} emptyMessage={t.emptyProduct} />
            </TabsContent>
            <TabsContent value="country" className="mt-0">
              <DimTable icon="country" rows={data?.by_country ?? []} currency={cur} emptyMessage={t.emptyCountry} />
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
        emptyTitle={t.noTransactions}
        emptyDescription={t.noTransactionsBody}
        toolbarLeft={
          <div>
            <h3 className="font-semibold text-foreground">{t.recentTransactions}</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{t.recentHint}</p>
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
                  {openTx.order_id ? t.order(openTx.order_id) : t.transaction}
                </SheetTitle>
                <SheetDescription>{fmtTime(openTx.occurred_at, locale)}</SheetDescription>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-2xl font-bold tabular-nums">{formatMoney(openTx.value, openTx.currency || cur)}</span>
                  {openTx.country && <Badge variant="outline">{openTx.country}</Badge>}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { label: t.dims.source, value: openTx.source ?? '—' },
                    { label: t.dims.medium, value: openTx.medium ?? '—' },
                    { label: t.dims.campaign, value: openTx.campaign ?? '—' },
                    { label: t.customer, value: openTx.user_type === 'new' ? t.newCustomer : openTx.user_type === 'returning' ? t.returning : '—' },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-lg border border-border p-2.5">
                      <p className="text-muted-foreground">{label}</p>
                      <p className="font-medium mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>
                {openTx.product_name && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">{t.lineItems}</p>
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
                    {t.openFullPage} <ExternalLink className="h-3.5 w-3.5 ml-2 opacity-50" />
                  </Link>
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </ReportPage>
  );
}
