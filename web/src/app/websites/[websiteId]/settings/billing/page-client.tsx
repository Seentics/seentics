'use client';

import { usePathSegment } from '@/lib/path-segment';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Activity, AlertTriangle, ArrowRight, BarChart3, Calendar, CreditCard, Filter, Gauge, Globe, Loader2, Map,
  ShieldCheck, Sparkles, Video, Workflow,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { useSubscription, type SubscriptionUsage } from '@/hooks/useSubscription';
import { useInvoices, useManualSubscription, useMeter, useSaveSpendCap, useTurnOffExtraUsage } from '@/features/billing/queries';
import { InvoiceList, TakaBilling } from '@/components/subscription/TakaBilling';
import type { MeterState } from '@/features/billing/types';
import { OFFER_YEARLY, RATES_LINE } from '@/features/plans/pricing-spec';
import api from '@/lib/api';
import { startCheckout } from '@/lib/checkout';
import { isDemo } from '@/lib/demo';
import { isEnterprise } from '@/lib/features';
import { cn } from '@/lib/utils';
import { websiteWorkspaceShellClass } from '@/lib/website-shell';
import { formatDate, offersManualPayments, useLocale, useT, type Messages } from '@/lib/i18n';

const GB = 1024 ** 3;

const fmt = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return n.toLocaleString();
};
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default function BillingSettingsPage() {
  const websiteId = usePathSegment(1) ?? '';
  const router = useRouter();
  const demo = isDemo(websiteId);
  const t = useT();
  const { locale, region } = useLocale();
  const fmtDate = (iso?: string) => formatDate(iso, locale);

  useEffect(() => {
    if (!isEnterprise && !demo) router.replace(`/websites/${websiteId}/settings`);
  }, [router, websiteId, demo]);

  const { subscription, loading } = useSubscription();
  const isPro = subscription?.planId === 'pro';
  const isStarter = subscription?.planId === 'starter';
  const isAgency = subscription?.planId === 'agency';
  const isPaid = isPro || isStarter || isAgency;
  // Extra usage is an add-on to Pro and Agency: the plans that can go past their included amounts.
  const canExtra = isPro || isAgency;
  const planName = isAgency ? 'Agency' : isPro ? 'Pro' : isStarter ? 'Starter' : t.pricing.free;
  const yearly = subscription?.billingInterval === 'year';
  const meter = useMeter({ demo, enabled: canExtra });
  const extraUsageOn = !!meter.data;
  const [busy, setBusy] = useState<string | null>(null);
  // Paying in taka: an account with a plan paid that way, or a free account in Bangladesh (which
  // buys with an invoice; /pricing still offers a card). A card subscription keeps the card's page.
  const manual = useManualSubscription({ enabled: isEnterprise && !demo });
  const invoices = useInvoices({ enabled: isEnterprise && !demo });
  const paysInTaka = !!manual.data || (!isPaid && offersManualPayments(region));

  if (!isEnterprise && !demo) return null;

  const notOnDemo = () => {
    if (demo) toast.info(t.billing.notOnDemo);
    return demo;
  };

  const checkout = async (plan: 'starter' | 'pro' | 'agency' | 'extra_usage', interval: 'month' | 'year' = 'month') => {
    if (notOnDemo()) return;
    try {
      setBusy(`${plan}:${interval}`);
      await startCheckout(plan, interval);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || t.billing.checkoutFailed);
    } finally {
      setBusy(null);
    }
  };

  /** The customer's own signed portal link: invoices, payment method, cancelling. */
  const openPortal = async () => {
    if (notOnDemo()) return;
    // Opened before the request resolves so the browser does not block it.
    const tab = window.open('', '_blank');
    try {
      setBusy('portal');
      const res = await api.post('/user/billing/portal');
      const url = res.data?.data?.url;
      if (!url) throw new Error('no portal');
      if (tab) tab.location.href = url; else window.location.href = url;
    } catch {
      tab?.close();
      toast.error(t.billing.portalFailed);
    } finally {
      setBusy(null);
    }
  };

  if (loading || (isEnterprise && !demo && manual.isLoading)) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
      </div>
    );
  }

  return (
    <div className={cn(websiteWorkspaceShellClass, 'space-y-6')}>
      <DashboardPageHeader websiteId={websiteId} title={t.billing.title} description={t.billing.description} />

      {paysInTaka ? (
        <TakaBilling demo={demo} />
      ) : (
      <>
      {/* Plan */}
      <Card className="border border-border">
        <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">{planName}</h2>
              {isPaid && yearly && (
                <Badge variant="outline" className="h-5 px-1.5 text-[11px] font-medium">{t.billing.yearly}</Badge>
              )}
              {subscription?.cancelAtPeriodEnd ? (
                <Badge className="h-5 border border-amber-500/20 bg-amber-500/10 px-1.5 text-[11px] font-medium text-amber-600">{t.billing.ending}</Badge>
              ) : (
                <Badge className="h-5 border border-emerald-500/20 bg-emerald-500/10 px-1.5 text-[11px] font-medium text-emerald-600">{t.billing.active}</Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {isPaid
                ? subscription?.cancelAtPeriodEnd
                  ? t.billing.endsThenFree(fmtDate(subscription.currentPeriodEnd))
                  : t.billing.renews(yearly ? t.billing.aYear(`$${subscription?.priceYearly ?? ''}`) : t.billing.aMonth(`$${subscription?.priceMonthly ?? ''}`), fmtDate(subscription?.currentPeriodEnd))
                : t.billing.freeLimits}
            </p>
            {isStarter && (
              <p className="mt-1 text-sm text-muted-foreground">{t.billing.starterUpsell}</p>
            )}
            {isPro && (
              <p className="mt-1 text-sm text-muted-foreground">{t.billing.proUpsell}</p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {isPaid ? (
              <>
                {isStarter && (
                  <Button size="sm" className="gap-1.5" onClick={() => checkout('pro', yearly ? 'year' : 'month')} disabled={busy !== null}>
                    {busy?.startsWith('pro:') ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    {t.billing.upgradeToPro} <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                )}
                {OFFER_YEARLY && !yearly && !subscription?.cancelAtPeriodEnd && (
                  <Button variant="outline" size="sm" onClick={() => checkout(isAgency ? 'agency' : isPro ? 'pro' : 'starter', 'year')} disabled={busy !== null}>
                    {t.billing.switchYearly}
                  </Button>
                )}
                <Button variant="outline" size="sm" className="gap-1.5" onClick={openPortal} disabled={busy !== null}>
                  {busy === 'portal' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
                  {t.billing.portal}
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/pricing">{t.billing.comparePlans}</Link>
                </Button>
                <Button variant="outline" size="sm" onClick={() => checkout('starter')} disabled={busy !== null}>
                  {busy === 'starter:month' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {t.billing.getStarter}
                </Button>
                <Button size="sm" className="gap-1.5" onClick={() => checkout('pro')} disabled={busy !== null}>
                  {busy === 'pro:month' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {t.billing.upgradeToPro} <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {canExtra && meter.isLoading && (
        <Card className="border border-border"><CardContent className="flex justify-center p-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card>
      )}
      {canExtra && meter.isError && (
        <p className="text-sm text-muted-foreground">{t.billing.meterFailed}</p>
      )}
      {canExtra && meter.isSuccess && !meter.data && (
        <ExtraUsageOff plan={planName} onTurnOn={() => checkout('extra_usage')} busy={busy === 'extra_usage:month'} disabled={busy !== null} t={t} />
      )}
      {canExtra && meter.data && (
        <>
          <ExtraUsagePeriod meter={meter.data} demo={demo} plan={planName} t={t} fmtDate={fmtDate} />
          <SpendCap meter={meter.data} demo={demo} plan={planName} t={t} />
        </>
      )}
      {/* A card customer who once paid in taka still sees those invoices. */}
      {!!invoices.data?.length && <InvoiceList invoices={invoices.data} />}
      </>
      )}

      <LimitsGrid usage={subscription?.usage} hideMetered={extraUsageOn && !paysInTaka} title={canExtra && extraUsageOn && !paysInTaka ? t.billing.otherUsage : t.billing.usageThisMonth} t={t} />
    </div>
  );
}

/** Pro or Agency without Extra usage: what turning it on means, and the button that does. */
function ExtraUsageOff({ plan, onTurnOn, busy, disabled, t }: { plan: string; onTurnOn: () => void; busy: boolean; disabled: boolean; t: Messages }) {
  return (
    <Card className="border border-border">
      <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-3">
          <Gauge className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <h3 className="text-sm font-semibold">{t.billing.extraOff.title}</h3>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">{t.billing.extraOff.body(plan, RATES_LINE)}</p>
          </div>
        </div>
        <Button size="sm" className="shrink-0 gap-1.5" onClick={onTurnOn} disabled={disabled}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {t.billing.extraOff.turnOn}
        </Button>
      </CardContent>
    </Card>
  );
}

/** This Extra usage period: what it has cost so far, and each metered resource against what the plan includes. */
function ExtraUsagePeriod({ meter, demo, plan, t, fmtDate }: { meter: MeterState; demo: boolean; plan: string; t: Messages; fmtDate: (iso?: string) => string }) {
  const turnOff = useTurnOffExtraUsage();
  const [confirm, confirmDialog] = useConfirm();
  const rows = [
    { icon: BarChart3, label: t.billing.extra.events, used: meter.used.events, included: meter.included.events, show: fmt, cost: meter.overage.credits.events },
    { icon: Video, label: t.billing.extra.recordings, used: meter.used.replays, included: meter.included.replays, show: fmt, cost: meter.overage.credits.replays },
    {
      icon: Activity, label: t.billing.extra.observe, used: meter.used.observeBytes / GB, included: meter.included.observeGb,
      show: (n: number) => `${n < 10 ? n.toFixed(1) : Math.round(n)} GB`, cost: meter.overage.credits.observe,
    },
  ];
  const capped = meter.billableCents < meter.overage.credits.total;

  const off = async () => {
    if (demo) { toast.info(t.billing.notOnDemo); return; }
    const ok = await confirm({
      title: t.billing.extra.confirmTitle,
      description: t.billing.extra.confirmBody(plan),
      confirmLabel: t.billing.extra.turnOff,
      destructive: true,
    });
    if (!ok) return;
    try {
      await turnOff.mutateAsync();
      toast.success(t.billing.extra.turnedOff);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || t.billing.extra.turnOffFailed);
    }
  };

  return (
    <Card className="border border-border">
      {confirmDialog}
      <CardContent className="p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t.billing.extra.thisPeriod}</p>
            <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">{money(meter.billableCents)}</p>
          </div>
          <div className="flex items-center gap-3">
            {meter.period && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                {fmtDate(meter.period.start)} – {fmtDate(meter.period.end)}
              </p>
            )}
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={off} disabled={turnOff.isPending}>
              {turnOff.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t.billing.extra.turnOff}
            </Button>
          </div>
        </div>

        {meter.paused && (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t.billing.extra.capReached(plan)}</span>
          </div>
        )}

        <ul className="mt-5 divide-y divide-border border-t border-border">
          {rows.map(({ icon: Icon, label, used, included, show, cost }) => {
            const share = included > 0 ? Math.min(100, (used / included) * 100) : 100;
            const over = used > included;
            return (
              <li key={label} className="py-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {label}
                  </span>
                  <span className={cn('tabular-nums', cost === 0 && 'text-muted-foreground')}>{cost === 0 ? t.billing.extra.included : money(cost)}</span>
                </div>
                <Progress value={share} className={cn('mt-2 h-1.5', over && '[&>div]:bg-amber-500')} />
                <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">
                  {t.billing.extra.ofIncluded(show(used), show(included))}{over ? t.billing.extra.extra(show(used - included)) : ''}
                </p>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          {t.billing.extra.footer(RATES_LINE, capped, plan)}
        </p>
      </CardContent>
    </Card>
  );
}

/** The most extra usage may cost in a month. */
function SpendCap({ meter, demo, plan, t }: { meter: MeterState; demo: boolean; plan: string; t: Messages }) {
  const save = useSaveSpendCap();
  const [dollars, setDollars] = useState(meter.spendCapCents != null ? String(meter.spendCapCents / 100) : '');
  useEffect(() => {
    setDollars(meter.spendCapCents != null ? String(meter.spendCapCents / 100) : '');
  }, [meter.spendCapCents]);

  const submit = async (cents: number | null) => {
    if (demo) { toast.info(t.billing.notOnDemo); return; }
    try {
      await save.mutateAsync(cents);
      toast.success(cents == null ? t.billing.cap.removed : t.billing.cap.saved(money(cents)));
    } catch (e: any) {
      toast.error(e?.response?.data?.error || t.billing.cap.failed);
    }
  };

  const parsed = Number(dollars);
  // At least $1: under that nothing is billed anyway. To allow none, turn extra usage off.
  const valid = dollars.trim() !== '' && Number.isFinite(parsed) && parsed >= 1;

  return (
    <Card className="border border-border">
      <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
          <div>
            <h3 className="text-sm font-semibold">{t.billing.cap.title}</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {meter.spendCapCents == null
                ? t.billing.cap.none(plan)
                : t.billing.cap.set(money(meter.spendCapCents))}
            </p>
          </div>
        </div>
        <form
          className="flex shrink-0 items-center gap-2"
          onSubmit={(e) => { e.preventDefault(); if (valid) void submit(Math.round(parsed * 100)); }}
        >
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
            <Input
              value={dollars}
              onChange={(e) => setDollars(e.target.value)}
              inputMode="decimal"
              placeholder={t.billing.cap.placeholder}
              className="h-9 w-28 pl-6 tabular-nums"
              aria-label={t.billing.cap.ariaLabel}
            />
          </div>
          <Button type="submit" size="sm" disabled={!valid || save.isPending}>
            {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t.billing.cap.save}
          </Button>
          {meter.spendCapCents != null && (
            <Button type="button" variant="ghost" size="sm" disabled={save.isPending} onClick={() => void submit(null)}>
              {t.billing.cap.remove}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

/**
 * Everything with a count against a limit. With Extra usage on, events and recordings are shown
 * with its period above instead.
 */
function LimitsGrid({ usage, hideMetered, title, t }: { usage?: SubscriptionUsage; hideMetered: boolean; title: string; t: Messages }) {
  const items: Array<{ name: string; icon: typeof BarChart3; status?: { current: number; limit: number } }> = [
    ...(hideMetered ? [] : [
      { name: t.billing.limits.events, icon: BarChart3, status: usage?.monthlyEvents },
      { name: t.billing.limits.replays, icon: Video, status: usage?.replays },
    ]),
    { name: t.billing.limits.ai, icon: Sparkles, status: usage?.aiAnalyses },
    { name: t.billing.limits.websites, icon: Globe, status: usage?.websites },
    { name: t.billing.limits.heatmaps, icon: Map, status: usage?.heatmaps },
    { name: t.billing.limits.funnels, icon: Filter, status: usage?.funnels },
    { name: t.billing.limits.automations, icon: Workflow, status: usage?.workflows },
  ];

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ name, icon: Icon, status }) => {
          const current = status?.current ?? 0;
          const limit = status?.limit ?? 0;
          const unlimited = limit === -1;
          const pct = unlimited || limit <= 0 ? 0 : Math.min(100, (current / limit) * 100);
          return (
            <Card key={name} className="border border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {name}
                  {!unlimited && pct >= 100 && (
                    <Badge className="ml-auto h-4 border border-red-500/20 bg-red-500/10 px-1.5 text-[10px] text-red-600">{t.billing.limitReached}</Badge>
                  )}
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-xl font-semibold tabular-nums">{fmt(current)}</span>
                  <span className="text-xs text-muted-foreground">{t.billing.of(unlimited ? t.billing.unlimited : fmt(limit))}</span>
                </div>
                {!unlimited && (
                  <Progress value={pct} className={cn('mt-2 h-1.5', pct >= 100 ? '[&>div]:bg-red-500' : pct >= 80 && '[&>div]:bg-amber-500')} />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
