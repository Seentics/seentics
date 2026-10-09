'use client';

import { usePathSegment } from '@/lib/path-segment';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Activity, AlertTriangle, ArrowRight, BarChart3, Calendar, CreditCard, Filter, Globe, Loader2, Map,
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
import { useMeter, useSaveSpendCap } from '@/features/billing/queries';
import type { MeterState } from '@/features/billing/types';
import { RATES_LINE } from '@/features/plans/pricing-spec';
import api from '@/lib/api';
import { startCheckout } from '@/lib/checkout';
import { isDemo } from '@/lib/demo';
import { isEnterprise } from '@/lib/features';
import { cn } from '@/lib/utils';
import { websiteWorkspaceShellClass } from '@/lib/website-shell';

const GB = 1024 ** 3;

const fmt = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return n.toLocaleString();
};
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : '—';

export default function BillingSettingsPage() {
  const websiteId = usePathSegment(1) ?? '';
  const router = useRouter();
  const demo = isDemo(websiteId);

  useEffect(() => {
    if (!isEnterprise && !demo) router.replace(`/websites/${websiteId}/settings`);
  }, [router, websiteId, demo]);

  const { subscription, loading } = useSubscription();
  const isPayg = subscription?.planId === 'payg';
  const meter = useMeter({ demo, enabled: isPayg });
  const [confirm, confirmDialog] = useConfirm();
  const [busy, setBusy] = useState<'checkout' | 'portal' | 'cancel' | null>(null);

  if (!isEnterprise && !demo) return null;

  const demoOnly = () => {
    toast.info('Billing is not available on the demo site.');
    return demo;
  };

  const upgrade = async () => {
    if (demo && demoOnly()) return;
    try {
      setBusy('checkout');
      await startCheckout('payg');
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Could not start the checkout. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  /** The customer's own signed portal link: invoices, payment method, cancelling. */
  const openPortal = async (kind: 'portal' | 'cancel') => {
    if (demo && demoOnly()) return;
    // Opened before the request resolves so the browser does not block it.
    const tab = window.open('', '_blank');
    try {
      setBusy(kind);
      const res = await api.post('/user/billing/portal');
      const url = res.data?.data?.url;
      if (!url) throw new Error('no portal');
      if (tab) tab.location.href = url; else window.location.href = url;
      if (kind === 'cancel') toast.info('Finish cancelling in the billing portal.');
    } catch {
      tab?.close();
      toast.error('Could not open the billing portal. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const cancel = async () => {
    const ok = await confirm({
      title: 'Cancel Pay-As-You-Go?',
      description: 'You keep it until the end of this billing period, including usage billed for it. Then your account moves to Free and its limits.',
      confirmLabel: 'Cancel subscription',
      destructive: true,
    });
    if (ok) await openPortal('cancel');
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
      </div>
    );
  }

  return (
    <div className={cn(websiteWorkspaceShellClass, 'space-y-6')}>
      {confirmDialog}
      <DashboardPageHeader websiteId={websiteId} title="Billing" description="Your plan, this month's usage and what it costs." />

      {/* Plan */}
      <Card className="border border-border">
        <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">{isPayg ? 'Pay-As-You-Go' : 'Free'}</h2>
              {subscription?.cancelAtPeriodEnd ? (
                <Badge className="h-5 border border-amber-500/20 bg-amber-500/10 px-1.5 text-[11px] font-medium text-amber-600">Ending</Badge>
              ) : (
                <Badge className="h-5 border border-emerald-500/20 bg-emerald-500/10 px-1.5 text-[11px] font-medium text-emerald-600">Active</Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {isPayg
                ? subscription?.cancelAtPeriodEnd
                  ? `Ends ${fmtDate(subscription.currentPeriodEnd)}, then your account moves to Free.`
                  : `$15 a month plus usage past what's included. Renews ${fmtDate(subscription?.currentPeriodEnd)}.`
                : 'Hard monthly limits. Collection pauses at a limit until the month resets.'}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {isPayg ? (
              <>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openPortal('portal')} disabled={busy !== null}>
                  {busy === 'portal' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
                  Invoices & payment
                </Button>
                {!subscription?.cancelAtPeriodEnd && (
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={cancel} disabled={busy !== null}>
                    Cancel
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/pricing">Compare plans</Link>
                </Button>
                <Button size="sm" className="gap-1.5" onClick={upgrade} disabled={busy !== null}>
                  {busy === 'checkout' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Upgrade to Pay-As-You-Go <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {isPayg && meter.data && <ThisPeriod meter={meter.data} />}
      {isPayg && meter.isLoading && (
        <Card className="border border-border"><CardContent className="flex justify-center p-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card>
      )}
      {isPayg && meter.isError && (
        <p className="text-sm text-muted-foreground">This period&apos;s usage could not be measured right now. Try again in a minute.</p>
      )}
      {isPayg && meter.data && <SpendCap meter={meter.data} demo={demo} />}

      <LimitsGrid usage={subscription?.usage} isPayg={isPayg} />
    </div>
  );
}

/** This period's bill: the base price plus each metered resource's overage, and its usage against what's included. */
function ThisPeriod({ meter }: { meter: MeterState }) {
  const rows = [
    { icon: BarChart3, label: 'Events', used: meter.used.events, included: meter.included.events, show: fmt, cost: meter.overage.credits.events },
    { icon: Video, label: 'Session recordings', used: meter.used.replays, included: meter.included.replays, show: fmt, cost: meter.overage.credits.replays },
    {
      icon: Activity, label: 'Logs, traces & metrics', used: meter.used.observeBytes / GB, included: meter.included.observeGb,
      show: (n: number) => `${n < 10 ? n.toFixed(1) : Math.round(n)} GB`, cost: meter.overage.credits.observe,
    },
  ];
  const capped = meter.billableCents < meter.overage.credits.total;

  return (
    <Card className="border border-border">
      <CardContent className="p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">This period so far</p>
            <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">{money(meter.baseCents + meter.billableCents)}</p>
          </div>
          {meter.period && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              {fmtDate(meter.period.start)} – {fmtDate(meter.period.end)}
            </p>
          )}
        </div>

        {meter.paused && (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Your spend cap is reached. Usage past what&apos;s included isn&apos;t being collected until the next period, or until you raise the cap.</span>
          </div>
        )}

        <ul className="mt-5 divide-y divide-border border-t border-border">
          <li className="flex items-center justify-between py-3 text-sm">
            <span className="text-muted-foreground">Pay-As-You-Go plan</span>
            <span className="tabular-nums">{money(meter.baseCents)}</span>
          </li>
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
                  <span className={cn('tabular-nums', cost === 0 && 'text-muted-foreground')}>{cost === 0 ? 'Included' : money(cost)}</span>
                </div>
                <Progress value={share} className={cn('mt-2 h-1.5', over && '[&>div]:bg-amber-500')} />
                <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">
                  {show(used)} of {show(included)} included{over ? ` · ${show(used - included)} over` : ''}
                </p>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          Past what&apos;s included: {RATES_LINE}.{capped ? ' Billed up to your spend cap.' : ''} Billed when the period ends.
        </p>
      </CardContent>
    </Card>
  );
}

/** The whole monthly bill's ceiling. */
function SpendCap({ meter, demo }: { meter: MeterState; demo: boolean }) {
  const save = useSaveSpendCap();
  const [dollars, setDollars] = useState(meter.spendCapCents != null ? String(meter.spendCapCents / 100) : '');
  useEffect(() => {
    setDollars(meter.spendCapCents != null ? String(meter.spendCapCents / 100) : '');
  }, [meter.spendCapCents]);

  const submit = async (cents: number | null) => {
    if (demo) { toast.info('Billing is not available on the demo site.'); return; }
    try {
      await save.mutateAsync(cents);
      toast.success(cents == null ? 'Spend cap removed.' : `Spend cap set to $${(cents / 100).toFixed(2)} a month.`);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Could not save the spend cap.');
    }
  };

  const parsed = Number(dollars);
  const valid = dollars.trim() !== '' && Number.isFinite(parsed) && parsed * 100 >= meter.baseCents;

  return (
    <Card className="border border-border">
      <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
          <div>
            <h3 className="text-sm font-semibold">Monthly spend cap</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {meter.spendCapCents == null
                ? 'No cap: usage past what’s included is always collected and billed.'
                : `You're never billed more than ${money(meter.spendCapCents)} a month. At the cap, collection past what's included pauses.`}
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
              placeholder="No cap"
              className="h-9 w-28 pl-6 tabular-nums"
              aria-label="Spend cap in dollars"
            />
          </div>
          <Button type="submit" size="sm" disabled={!valid || save.isPending}>
            {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
          </Button>
          {meter.spendCapCents != null && (
            <Button type="button" variant="ghost" size="sm" disabled={save.isPending} onClick={() => void submit(null)}>
              Remove
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

/** Everything with a count: Free's hard limits, or what Pay-As-You-Go leaves unlimited. */
function LimitsGrid({ usage, isPayg }: { usage?: SubscriptionUsage; isPayg: boolean }) {
  const items: Array<{ name: string; icon: typeof BarChart3; status?: { current: number; limit: number } }> = [
    // Pay-As-You-Go shows events and recordings with this period's bill above.
    ...(isPayg ? [] : [
      { name: 'Events this month', icon: BarChart3, status: usage?.monthlyEvents },
      { name: 'Session recordings', icon: Video, status: usage?.replays },
    ]),
    { name: 'AI analyses', icon: Sparkles, status: usage?.aiAnalyses },
    { name: 'Websites', icon: Globe, status: usage?.websites },
    { name: 'Heatmap pages', icon: Map, status: usage?.heatmaps },
    { name: 'Funnels', icon: Filter, status: usage?.funnels },
    { name: 'Automations', icon: Workflow, status: usage?.workflows },
  ];

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold">{isPayg ? 'Other usage' : 'Usage this month'}</h3>
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
                    <Badge className="ml-auto h-4 border border-red-500/20 bg-red-500/10 px-1.5 text-[10px] text-red-600">Limit reached</Badge>
                  )}
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-xl font-semibold tabular-nums">{fmt(current)}</span>
                  <span className="text-xs text-muted-foreground">of {unlimited ? 'Unlimited' : fmt(limit)}</span>
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
