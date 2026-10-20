'use client';

import { usePathSegment } from '@/lib/path-segment';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRevenueTransaction, formatMoney } from '@/lib/revenue-analytics';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Receipt, Globe, Share2, Package, UserRound, Copy, CalendarClock, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { fmtTime, lineItems } from '@/features/revenue/format';
import { useLocale, useT } from '@/lib/i18n';

export default function RevenueTransactionPage() {
  const params = { websiteId: usePathSegment(1) ?? '', transactionId: usePathSegment(4) ?? '' };
  const router = useRouter();
  const all = useT();
  const t = all.revenue.transaction;
  const { locale } = useLocale();
  const websiteId = params?.websiteId as string;
  const transactionId = params?.transactionId as string;
  // The one order, read by id. It was looked up in the dashboard's latest 50, so any older
  // order — and any failed request — read as "not found".
  const { data: tx, isLoading, isError, refetch } = useRevenueTransaction(websiteId, decodeURIComponent(transactionId));

  if (isLoading) {
    return (
      <div className="p-4 md:p-5 lg:px-6 lg:py-5 max-w-[1100px] mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    );
  }

  if (!tx) {
    return (
      <div className="p-4 md:p-5 lg:px-6 lg:py-5 max-w-[1100px] mx-auto text-center">
        <p className="text-sm text-muted-foreground">{isError ? t.loadFailed : t.notFound}</p>
        <div className="mt-4 flex justify-center gap-2">
          {isError && (
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              {all.actions.retry}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> {all.actions.back}
          </Button>
          <Button variant="default" size="sm" asChild>
            <Link href={`/websites/${websiteId}/revenue`}>{t.overview}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const money = (n: number) => formatMoney(n, tx.currency || 'USD');
  const items = lineItems(tx);
  // Only a subtotal every line has a price for: a line without one would understate it.
  const itemsTotal = items.every((it) => it.price !== null)
    ? items.reduce((sum, it) => sum + (it.price ?? 0) * it.qty, 0)
    : null;
  const customer = tx.user_type === 'new' ? t.newCustomer : tx.user_type === 'returning' ? t.returningCustomer : t.unknown;
  const medium = tx.medium && tx.medium !== 'none' ? tx.medium : '—';

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-4 py-2.5 text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right font-medium text-foreground">{children}</span>
    </div>
  );
  const SideCard = ({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) => (
    <Card className="rounded-lg border border-border shadow-sm">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="divide-y divide-border px-4">{children}</div>
    </Card>
  );

  return (
    <div className="p-4 md:p-5 lg:px-6 lg:py-5 max-w-[1100px] mx-auto">
      <button
        type="button"
        onClick={() => router.push(`/websites/${websiteId}/revenue`)}
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t.allRevenue}
      </button>

      {/* Summary */}
      <Card className="mb-4 rounded-lg border border-border shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Receipt className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-lg font-bold tracking-tight text-foreground">
                  {tx.order_id ? all.revenue.page.order(tx.order_id) : all.revenue.page.transaction}
                </h1>
                <Badge className="h-5 gap-1 border-0 bg-emerald-500/10 px-2 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" /> {t.purchase}
                </Badge>
              </div>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5" />
                {fmtTime(tx.occurred_at, locale, 'full')}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t.orderTotal}</p>
            <p className="text-3xl font-bold tabular-nums tracking-tight text-foreground">{money(tx.value)}</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Order */}
        <Card className="self-start overflow-hidden rounded-lg border border-border shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">{t.orderItems}</h3>
            </div>
            <span className="text-[11px] text-muted-foreground">
              {t.items(items.length)}
            </span>
          </div>

          {items.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">
              {t.noItems}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-[1fr_56px_96px] gap-2 border-b border-border bg-muted/30 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <span>{t.item}</span>
                <span className="text-right">{t.qty}</span>
                <span className="text-right">{t.price}</span>
              </div>
              <ul className="divide-y divide-border">
                {items.map((it, i) => (
                  <li key={i} className="grid grid-cols-[1fr_56px_96px] items-center gap-2 px-4 py-3 text-sm">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <Package className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{it.name}</p>
                        {it.sku && <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{it.sku}</p>}
                      </div>
                    </div>
                    <span className="text-right tabular-nums text-muted-foreground">×{it.qty}</span>
                    <span className="text-right font-semibold tabular-nums">{it.price === null ? '—' : money(it.price * it.qty)}</span>
                  </li>
                ))}
              </ul>
              <div className="space-y-1.5 border-t border-border bg-muted/20 px-4 py-3 text-[13px]">
                {itemsTotal !== null && Math.abs(itemsTotal - tx.value) > 0.005 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t.subtotal}</span>
                    <span className="tabular-nums">{money(itemsTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-foreground">
                  <span>{t.total}</span>
                  <span className="tabular-nums">{money(tx.value)}</span>
                </div>
              </div>
            </>
          )}
        </Card>

        {/* Sidebar */}
        <div className="space-y-4">
          <SideCard icon={Share2} title={t.attribution}>
            <Row label={t.source}>{tx.source || 'direct'}</Row>
            <Row label={t.medium}>{medium}</Row>
            <Row label={t.campaign}>{tx.campaign && tx.campaign !== '(none)' ? tx.campaign : '—'}</Row>
          </SideCard>

          <SideCard icon={UserRound} title={t.customer}>
            <Row label={t.type}>{customer}</Row>
          </SideCard>

          <SideCard icon={Globe} title={t.location}>
            <Row label={t.country}>{tx.country || '—'}</Row>
          </SideCard>

          <SideCard icon={Receipt} title={t.reference}>
            <Row label={t.orderId}>{tx.order_id ?? '—'}</Row>
            <div className="flex items-center justify-between gap-4 py-2.5 text-[13px]">
              <span className="text-muted-foreground">{t.eventId}</span>
              <button
                type="button"
                onClick={() => { navigator.clipboard?.writeText(tx.id); toast.success(t.copied); }}
                className="inline-flex min-w-0 items-center gap-1.5 font-mono text-xs text-foreground hover:text-primary"
                title={t.copy}
              >
                <span className="truncate">{tx.id}</span>
                <Copy className="h-3 w-3 shrink-0 opacity-60" />
              </button>
            </div>
          </SideCard>
        </div>
      </div>
    </div>
  );
}
