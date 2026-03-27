'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CreditCard, Zap, Check, BarChart3, Filter, Workflow, Loader2,
  Map, Video, Globe, ExternalLink, Calendar, AlertTriangle, ArrowUpRight,
  Users, Building2,
} from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { toast } from 'sonner';
import { UpgradePlanModal } from '@/components/subscription/UpgradePlanModal';
import { PlanBuilder, PlanSelection } from '@/components/subscription/PlanBuilder';
import api from '@/lib/api';
import { openCheckout } from '@/lib/checkout';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { isDemo } from '@/lib/demo';
import { isEnterprise } from '@/lib/features';
import { cn } from '@/lib/utils';

// ─── Plan metadata ─────────────────────────────────────────────────────────

const planPriceMap: Record<string, number> = {
    free: 0, starter: 0,
    basic: 9, growth: 19, pro: 49,
    agency: 99, agency_pro: 249,
};

const planNameMap: Record<string, string> = {
    free: 'Free', starter: 'Free',
    basic: 'Starter', growth: 'Growth', pro: 'Pro',
    agency: 'Agency', agency_pro: 'Agency Pro',
};

const planDescriptions: Record<string, string> = {
    free: 'For side projects and personal sites',
    starter: 'For side projects and personal sites',
    basic: 'For indie makers and small projects',
    growth: 'For growing products and teams',
    pro: 'For scaling teams and high-traffic apps',
    agency: 'For agencies managing multiple clients',
    agency_pro: 'For large agencies with dedicated support',
};

const planFeatures: Record<string, string[]> = {
    free:       ['Unlimited Websites', '10K Monthly Events', '100 Session Recordings', '3 Heatmap Pages', '1 Funnel', '1 Automation', '30 Day Retention', 'API, SDK & UI Blocks', '1 Team Member', 'Community Support'],
    starter:    ['Unlimited Websites', '10K Monthly Events', '100 Session Recordings', '3 Heatmap Pages', '1 Funnel', '1 Automation', '30 Day Retention', 'API, SDK & UI Blocks', '1 Team Member', 'Community Support'],
    basic:      ['Unlimited Websites', '100K Monthly Events', '1,000 Session Recordings', 'Unlimited Heatmaps', 'Unlimited Funnels & Automations', '1 Year Retention', 'API, SDK & UI Blocks', '3 Team Members', 'Email Support'],
    growth:     ['Unlimited Websites', '500K Monthly Events', '10,000 Session Recordings', 'Unlimited Heatmaps', 'Unlimited Funnels & Automations', '2 Year Retention', 'API, SDK & UI Blocks', '5 Team Members', 'Email Support'],
    pro:        ['Unlimited Websites', '2M Monthly Events', '50,000 Session Recordings', 'Unlimited Heatmaps', 'Unlimited Funnels & Automations', '5 Year Retention', 'API, SDK & UI Blocks', '10 Team Members', 'Priority Support'],
    agency:     ['Unlimited Client Workspaces', '5M Monthly Events', '100K Session Recordings', 'Unlimited Heatmaps', 'White Label', 'Custom Domain', '3 Year Retention', 'API, SDK & UI Blocks', 'Priority Support'],
    agency_pro: ['Unlimited Client Workspaces', '20M Monthly Events', '500K Session Recordings', 'Unlimited Heatmaps', 'White Label', 'Custom Domain', 'Client Portal', '7 Year Retention', 'API, SDK & UI Blocks', 'Dedicated Support & SLA'],
};

const AGENCY_PLANS = ['agency', 'agency_pro'];

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
    return n.toLocaleString();
};

const fmtDate = (iso?: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
};

// ─── Page ───────────────────────────────────────────────────────────────────

export default function AccountBillingSettings() {
    const params = useParams();
    const websiteId = params?.websiteId as string;
    const router = useRouter();

    useEffect(() => {
        if (!isEnterprise) router.replace(`/websites/${websiteId}`);
    }, [router, websiteId]);

    if (!isEnterprise) return null;

    const { subscription, loading, getUsagePercentage } = useSubscription();
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [planMode, setPlanMode] = useState<'individual' | 'agency'>('individual');

    const rawPlan = subscription?.plan?.toLowerCase() || 'starter';
    const currentPlan = rawPlan === 'free' ? 'starter' : rawPlan;
    const planPrice = subscription?.priceMonthly ?? planPriceMap[currentPlan] ?? 0;
    const isFreePlan = currentPlan === 'starter' || currentPlan === 'free';
    const isAgencyPlan = AGENCY_PLANS.includes(currentPlan);
    const displayName = planNameMap[currentPlan] || currentPlan;
    const periodLabel = isFreePlan ? '' : subscription?.billingInterval === 'yearly' ? '/mo (billed yearly)' : '/month';

    const handleManagePayments = () => {
        if (isDemo(websiteId)) { toast.info('Billing not available in demo mode.'); return; }
        window.open('https://seentics.lemonsqueezy.com/billing', '_blank');
    };

    const handleCancel = async () => {
        if (isDemo(websiteId)) { toast.info('Billing not available in demo mode.'); return; }
        if (!confirm('Cancel your subscription? Your plan will revert to Free at the end of the current billing period.')) return;
        try {
            setCancelling(true);
            const res = await api.post('/user/billing/cancel');
            if (res.data.success && res.data.data.url) {
                window.open(res.data.data.url, '_blank');
                toast.info('Complete the cancellation in the billing portal.');
            }
        } catch { toast.error('Failed to initiate cancellation. Please try again.'); }
        finally { setCancelling(false); }
    };

    const handleCheckout = async (selection: PlanSelection) => {
        if (isDemo(websiteId)) { toast.info('Billing not available in demo mode.'); return; }
        if (selection.price === 0) { router.push(`/websites/${websiteId}`); return; }
        try {
            setCheckoutLoading(true);
            const res = await api.post('/user/billing/checkout', { plan: selection.plan, billing: selection.billing });
            if (res.data.success && res.data.data.checkoutUrl) openCheckout(res.data.data.checkoutUrl);
        } catch (e: any) {
            toast.error(e.response?.data?.message || 'Failed to create checkout. Please try again.');
        } finally { setCheckoutLoading(false); }
    };

    const usageItems = [
        { name: 'Monthly Events',      key: 'monthlyEvents', icon: BarChart3, current: subscription?.usage?.monthlyEvents?.current || 0, limit: subscription?.usage?.monthlyEvents?.limit || 10000 },
        { name: 'Websites',            key: 'websites',      icon: Globe,     current: subscription?.usage?.websites?.current || 0,      limit: subscription?.usage?.websites?.limit || 0 },
        { name: 'Funnels',             key: 'funnels',       icon: Filter,    current: subscription?.usage?.funnels?.current || 0,        limit: subscription?.usage?.funnels?.limit || 1 },
        { name: 'Automations',         key: 'workflows',     icon: Workflow,  current: subscription?.usage?.workflows?.current || 0,      limit: subscription?.usage?.workflows?.limit || 1 },
        { name: 'Heatmaps',            key: 'heatmaps',      icon: Map,       current: subscription?.usage?.heatmaps?.current || 0,       limit: subscription?.usage?.heatmaps?.limit || 3 },
        { name: 'Session Recordings',  key: 'replays',       icon: Video,     current: subscription?.usage?.replays?.current || 0,        limit: subscription?.usage?.replays?.limit || 100 },
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
            </div>
        );
    }

    return (
        <div className="max-w-[1200px] mx-auto p-4 sm:p-8 space-y-8 animate-in fade-in duration-500">
            <DashboardPageHeader
                title="Billing & Subscription"
                description="Manage your plan, usage limits, and billing details."
            />

            <Tabs defaultValue="overview">
                <TabsList className="mb-6">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="plans">Change Plan</TabsTrigger>
                </TabsList>

                {/* ── Overview tab ── */}
                <TabsContent value="overview">
                    <div className="grid lg:grid-cols-3 gap-6">
                        {/* Left: plan + usage */}
                        <div className="lg:col-span-2 space-y-6">

                            {/* Current plan card */}
                            <Card className="border border-border/60">
                                <CardContent className="p-6">
                                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Current Plan</span>
                                                <Badge className="text-[10px] px-1.5 py-0 h-4 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-medium">
                                                    Active
                                                </Badge>
                                                {isAgencyPlan && (
                                                    <Badge className="text-[10px] px-1.5 py-0 h-4 bg-violet-500/10 text-violet-600 border border-violet-500/20 font-medium">
                                                        Agency
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex items-baseline gap-2">
                                                <h2 className="text-4xl font-bold tracking-tight">
                                                    {isFreePlan ? 'Free' : `$${planPrice}`}
                                                </h2>
                                                {!isFreePlan && (
                                                    <span className="text-sm text-muted-foreground">{periodLabel}</span>
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                <span className="font-medium text-foreground">{displayName}</span>
                                                {' — '}{planDescriptions[currentPlan] || ''}
                                            </p>
                                        </div>

                                        {/* Renewal info */}
                                        {!isFreePlan && subscription?.currentPeriodEnd && (
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 border border-border/40 rounded-lg px-3 py-2 shrink-0">
                                                <Calendar className="h-3.5 w-3.5 shrink-0" />
                                                <span>Renews {fmtDate(subscription.currentPeriodEnd)}</span>
                                            </div>
                                        )}
                                        {subscription?.cancelAtPeriodEnd && (
                                            <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 shrink-0">
                                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                                <span>Cancels {fmtDate(subscription.currentPeriodEnd)}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        <Button size="sm" className="gap-1.5 text-xs" onClick={() => setIsUpgradeModalOpen(true)}>
                                            <Zap className="h-3.5 w-3.5" />
                                            {isFreePlan ? 'Upgrade Plan' : 'Change Plan'}
                                        </Button>
                                        {!isFreePlan && (
                                            <Button variant="outline" size="sm" onClick={handleManagePayments} className="gap-1.5 text-xs">
                                                <CreditCard className="h-3.5 w-3.5" />
                                                Manage Payments
                                            </Button>
                                        )}
                                        {!isFreePlan && !subscription?.cancelAtPeriodEnd && (
                                            <Button
                                                variant="ghost" size="sm"
                                                onClick={handleCancel} disabled={cancelling}
                                                className="text-xs text-muted-foreground hover:text-destructive"
                                            >
                                                {cancelling ? 'Processing…' : 'Cancel Subscription'}
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Usage */}
                            <div>
                                <h3 className="text-sm font-semibold mb-3">Usage this month</h3>
                                <div className="grid sm:grid-cols-2 gap-3">
                                    {usageItems.filter(r => r.limit !== 0).map(resource => {
                                        const pct = getUsagePercentage(resource.key as any);
                                        const Icon = resource.icon;
                                        const isUnlimited = resource.limit === -1;
                                        const isNear = pct >= 80 && !isUnlimited;
                                        const isAt = pct >= 100 && !isUnlimited;

                                        return (
                                            <Card key={resource.name} className="border border-border/60">
                                                <CardContent className="p-4">
                                                    <div className="flex items-center gap-2.5 mb-3">
                                                        <div className="h-8 w-8 rounded-lg bg-primary/5 flex items-center justify-center">
                                                            <Icon className="h-4 w-4 text-primary" />
                                                        </div>
                                                        <span className="text-sm font-medium">{resource.name}</span>
                                                        {isAt && <Badge className="ml-auto text-[10px] px-1.5 py-0 h-4 bg-red-500/10 text-red-600 border border-red-500/20">Limit reached</Badge>}
                                                        {isNear && !isAt && <Badge className="ml-auto text-[10px] px-1.5 py-0 h-4 bg-amber-500/10 text-amber-600 border border-amber-500/20">Near limit</Badge>}
                                                    </div>
                                                    <div className="flex justify-between items-baseline mb-2">
                                                        <span className="text-xl font-semibold">{fmt(resource.current)}</span>
                                                        <span className="text-xs text-muted-foreground">
                                                            of {isUnlimited ? 'Unlimited' : fmt(resource.limit)}
                                                        </span>
                                                    </div>
                                                    <Progress
                                                        value={isUnlimited ? 0 : Math.min(pct, 100)}
                                                        className={cn('h-1.5',
                                                            isAt ? '[&>div]:bg-red-500' :
                                                            isNear ? '[&>div]:bg-amber-500' : ''
                                                        )}
                                                    />
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>

                                {/* Upgrade nudge if any limit is near */}
                                {usageItems.some(r => getUsagePercentage(r.key as any) >= 80 && r.limit !== -1) && (
                                    <div className="mt-3 flex items-center gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                                        <p className="text-xs text-amber-700 dark:text-amber-400 flex-1">
                                            You're approaching some plan limits.
                                        </p>
                                        <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => setIsUpgradeModalOpen(true)}>
                                            Upgrade <ArrowUpRight className="h-3 w-3" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right: features + support */}
                        <div className="space-y-5">
                            <Card className="border border-border/60">
                                <CardContent className="p-5">
                                    <h4 className="text-sm font-semibold mb-4">
                                        Included in <span className="capitalize">{subscription?.isCustomPlan ? 'Custom' : displayName}</span>
                                    </h4>
                                    <ul className="space-y-2.5">
                                        {(planFeatures[currentPlan] || planFeatures.starter).map((f, i) => (
                                            <li key={i} className="flex items-start gap-2.5 text-xs text-muted-foreground">
                                                <div className="h-4 w-4 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                                                    <Check className="h-2.5 w-2.5 text-emerald-500" />
                                                </div>
                                                <span className="leading-relaxed">{f}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                            </Card>

                            <Card className="border border-border/60">
                                <CardContent className="p-5 space-y-4">
                                    <h4 className="text-sm font-semibold">Billing Support</h4>
                                    <p className="text-xs text-muted-foreground">
                                        Questions about your invoice or need a custom plan?
                                    </p>
                                    <div className="p-3 rounded-lg bg-muted/30 border border-border/40">
                                        <p className="text-xs text-muted-foreground mb-0.5">Contact</p>
                                        <p className="text-sm font-medium text-primary">billing@seentics.com</p>
                                    </div>
                                    <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={handleManagePayments}>
                                        <ExternalLink className="h-3.5 w-3.5" />
                                        View Invoices
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {/* ── Change plan tab ── */}
                <TabsContent value="plans">
                    <div className="space-y-6">
                        {/* Individual / Agency switcher */}
                        <div className="flex justify-center">
                            <div className="flex items-center gap-1 p-1 bg-muted/50 border border-border/60 rounded-xl">
                                <button
                                    onClick={() => setPlanMode('individual')}
                                    className={cn(
                                        'flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all',
                                        planMode === 'individual'
                                            ? 'bg-background text-foreground shadow-sm border border-border/60'
                                            : 'text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    <Users className="h-4 w-4" />
                                    Individual
                                </button>
                                <button
                                    onClick={() => setPlanMode('agency')}
                                    className={cn(
                                        'flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all',
                                        planMode === 'agency'
                                            ? 'bg-background text-foreground shadow-sm border border-border/60'
                                            : 'text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    <Building2 className="h-4 w-4" />
                                    Agency
                                </button>
                            </div>
                        </div>

                        {planMode === 'agency' && (
                            <p className="text-center text-sm text-muted-foreground max-w-lg mx-auto">
                                Manage unlimited client workspaces, white-label the platform, and access all data via API. Events are pooled across all clients.
                            </p>
                        )}

                        <PlanBuilder
                            onSubscribe={handleCheckout}
                            loading={checkoutLoading}
                            currentPlan={currentPlan}
                            mode={planMode}
                        />
                    </div>
                </TabsContent>
            </Tabs>

            <UpgradePlanModal
                isOpen={isUpgradeModalOpen}
                onClose={() => setIsUpgradeModalOpen(false)}
                currentPlan={currentPlan}
                limitType="monthlyEvents"
                currentUsage={subscription?.usage?.monthlyEvents?.current || 0}
                limit={subscription?.usage?.monthlyEvents?.limit || 10000}
            />
        </div>
    );
}
