'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { AlertTriangle, ArrowRight, FileText, Loader2, Smartphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useInvoices, useManualSubscription } from '@/features/billing/queries';
import type { Invoice, InvoiceStatus } from '@/features/billing/types';
import { formatTaka } from '@/features/plans/pricing-spec';
import { usePlans } from '@/features/plans/queries';
import { invoiceUrl, startInvoiceCheckout } from '@/lib/checkout';
import { formatDate, useLocale, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const STATUS_TONE: Record<InvoiceStatus, string> = {
  open: 'border-amber-500/20 bg-amber-500/10 text-amber-600',
  submitted: 'border-sky-500/20 bg-sky-500/10 text-sky-600',
  paid: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600',
  rejected: 'border-red-500/20 bg-red-500/10 text-red-600',
  void: 'border-border bg-muted text-muted-foreground',
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const t = useT();
  return <Badge className={cn('h-5 border px-1.5 text-[11px] font-medium', STATUS_TONE[status])}>{t.bd.status[status]}</Badge>;
}

/** Whether an invoice still wants paying: unpaid, or sent back to correct. */
const payable = (invoice: Invoice) => invoice.status === 'open' || invoice.status === 'rejected';

/**
 * Billing for an account that pays in taka (Bangladesh): the plan paid for and until when, the
 * renewal to pay when one is due, buying or switching plans with a new invoice, and every invoice.
 * Extra usage is not sold in taka, so none of its controls are here.
 */
export function TakaBilling({ demo }: { demo: boolean }) {
  const t = useT();
  const { locale } = useLocale();
  const manual = useManualSubscription({ enabled: !demo });
  const invoices = useInvoices({ enabled: !demo });
  const { data: plans } = usePlans();
  const [busy, setBusy] = useState<string | null>(null);

  const sub = manual.data ?? null;
  const list = invoices.data ?? [];
  const due = list.find((i) => payable(i) && i.kind === 'renewal') ?? list.find(payable) ?? null;
  const taka = (planId: string, interval: 'month' | 'year') => {
    const plan = plans?.find((p) => p.id === planId);
    const amount = interval === 'year' ? plan?.priceYearlyBdt : plan?.priceMonthlyBdt;
    return amount != null ? formatTaka(amount) : null;
  };
  const name = (planId: string) => plans?.find((p) => p.id === planId)?.name ?? planId;

  const buy = async (plan: 'starter' | 'pro' | 'agency', interval: 'month' | 'year') => {
    if (demo) { toast.info(t.billing.notOnDemo); return; }
    try {
      setBusy(`${plan}:${interval}`);
      await startInvoiceCheckout(plan, interval);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || t.bd.createFailed);
      setBusy(null);
    }
  };

  const choices: Array<{ plan: 'starter' | 'pro' | 'agency'; interval: 'month' | 'year'; label: string; primary?: boolean }> = !sub
    ? [
        { plan: 'starter', interval: 'month', label: t.bd.getPlan(name('starter')) },
        { plan: 'pro', interval: 'month', label: t.bd.getPlan(name('pro')), primary: true },
      ]
    : [
        ...(sub.planId === 'starter' ? [{ plan: 'pro' as const, interval: sub.interval, label: t.bd.switchTo(name('pro')), primary: true }] : []),
        ...(sub.planId === 'pro' ? [{ plan: 'agency' as const, interval: sub.interval, label: t.bd.switchTo(name('agency')) }] : []),
        ...(sub.interval === 'month' && (sub.planId === 'starter' || sub.planId === 'pro' || sub.planId === 'agency')
          ? [{ plan: sub.planId as 'starter' | 'pro' | 'agency', interval: 'year' as const, label: t.bd.switchYearly }]
          : []),
      ];

  if (manual.isLoading) {
    return <Card className="border border-border"><CardContent className="flex justify-center p-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <Card className="border border-border">
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">{sub ? sub.planName : name('free')}</h2>
                {sub && (
                  <>
                    <Badge variant="outline" className="h-5 px-1.5 text-[11px] font-medium">{t.bd.interval[sub.interval]}</Badge>
                    {sub.status === 'past_due' ? (
                      <Badge className="h-5 border border-amber-500/20 bg-amber-500/10 px-1.5 text-[11px] font-medium text-amber-600">{t.billing.gracePeriod}</Badge>
                    ) : (
                      <Badge className="h-5 border border-emerald-500/20 bg-emerald-500/10 px-1.5 text-[11px] font-medium text-emerald-600">{t.billing.active}</Badge>
                    )}
                  </>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {sub
                  ? [taka(sub.planId, sub.interval) && (sub.interval === 'year' ? t.bd.perYear(taka(sub.planId, sub.interval)!) : t.bd.perMonth(taka(sub.planId, sub.interval)!)), t.bd.paidUntil(formatDate(sub.currentPeriodEnd, locale))]
                      .filter(Boolean)
                      .join(' · ')
                  : t.billing.freeLimits}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {due && (
                <Button size="sm" className="gap-1.5" asChild>
                  <Link href={invoiceUrl(due.id)}>
                    {due.kind === 'renewal' ? t.bd.payRenewal : t.bd.payInvoice} <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              )}
              {!sub && (
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/pricing">{t.billing.comparePlans}</Link>
                </Button>
              )}
              {choices.map((c) => (
                <Button
                  key={`${c.plan}:${c.interval}`}
                  size="sm"
                  variant={c.primary && !due ? 'default' : 'outline'}
                  className="gap-1.5"
                  onClick={() => buy(c.plan, c.interval)}
                  disabled={busy !== null}
                >
                  {busy === `${c.plan}:${c.interval}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {c.label}
                  {taka(c.plan, c.interval) && <span className="text-muted-foreground">· {taka(c.plan, c.interval)}</span>}
                </Button>
              ))}
            </div>
          </div>

          {sub?.status === 'past_due' && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{t.bd.graceWarning(formatDate(sub.graceEndsAt, locale))}</span>
            </div>
          )}

          <div className="flex items-start gap-2.5 border-t border-border pt-4 text-sm text-muted-foreground">
            <Smartphone className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <span className="font-medium text-foreground">{t.bd.sectionTitle}.</span> {t.bd.sectionBody}
            </span>
          </div>
        </CardContent>
      </Card>

      <InvoiceList invoices={list} loading={invoices.isLoading} />
    </div>
  );
}

/** Every taka invoice, newest first, each opening its page. */
export function InvoiceList({ invoices, loading }: { invoices: Invoice[]; loading?: boolean }) {
  const t = useT();
  const { locale } = useLocale();
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold">{t.bd.invoices}</h3>
      <Card className="border border-border">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : invoices.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{t.bd.noInvoices}</p>
          ) : (
            <ul className="divide-y divide-border">
              {invoices.map((invoice) => (
                <li key={invoice.id}>
                  <Link href={invoiceUrl(invoice.id)} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm transition-colors hover:bg-muted/40">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="font-mono text-[13px]">{invoice.number}</span>
                    <span className="text-muted-foreground">
                      {invoice.planName} · {t.bd.interval[invoice.interval]} · {t.bd.kind[invoice.kind]}
                    </span>
                    <span className="ml-auto flex items-center gap-3">
                      <span className="text-muted-foreground">{formatDate(invoice.paidAt ?? invoice.createdAt, locale)}</span>
                      <span className="font-semibold tabular-nums">{formatTaka(invoice.amountBdt)}</span>
                      <InvoiceStatusBadge status={invoice.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
