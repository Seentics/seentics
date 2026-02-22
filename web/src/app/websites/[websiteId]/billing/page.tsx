'use client';

import React, { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CreditCard, Zap, Check, BarChart3, Filter, Workflow, Loader2, Map, Video, Globe, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useSubscription } from '@/hooks/useSubscription';
import { toast } from 'sonner';
import { UpgradePlanModal } from '@/components/subscription/UpgradePlanModal';
import api from '@/lib/api';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { isEnterprise } from '@/lib/features';
import { cn } from '@/lib/utils';

const planPriceMap: Record<string, number> = {
    starter: 0,
    growth: 29,
    pro: 79,
    enterprise: 399,
};

const planDescriptions: Record<string, string> = {
    starter: 'For side projects and personal sites',
    growth: 'For growing businesses',
    pro: 'For scaling teams with priority support',
    enterprise: 'For agencies and large teams',
};

const planFeatures: Record<string, string[]> = {
    starter: [
        'Analytics Dashboard',
        '10K Monthly Events',
        '1 Website',
        '1 Funnel',
        '1 Automation',
        '3 Heatmaps',
        '100 Session Recordings',
        '30 Day Data Retention',
        'Community Support',
    ],
    growth: [
        'Analytics Dashboard',
        '200K Monthly Events',
        '3 Websites',
        '10 Funnels',
        '10 Automations',
        'Unlimited Heatmaps',
        '10,000 Session Recordings',
        '2 Year Analytics Retention',
        '3 Month Recording Retention',
        'Email Support',
    ],
    pro: [
        'Analytics Dashboard',
        '2M Monthly Events',
        '15 Websites',
        'Unlimited Funnels',
        'Unlimited Automations',
        'Unlimited Heatmaps',
        '50,000 Session Recordings',
        '5 Year Analytics Retention',
        '3 Month Recording Retention',
        'Priority Support',
    ],
    enterprise: [
        'Analytics Dashboard',
        '15M Monthly Events',
        '100 Websites',
        'Unlimited Funnels',
        'Unlimited Automations',
        'Unlimited Heatmaps',
        '200,000 Session Recordings',
        '7 Year Analytics Retention',
        '3 Month Recording Retention',
        'White Labeling',
        'Client Management',
        'Dedicated Support',
    ],
};

export default function AccountBillingSettings() {
    const params = useParams();
    const websiteId = params?.websiteId as string;
    const router = useRouter();

    useEffect(() => {
        if (!isEnterprise) {
            router.replace(`/websites/${websiteId}`);
        }
    }, [router, websiteId]);

    if (!isEnterprise) return null;
    const { subscription, loading, getUsagePercentage } = useSubscription();
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = React.useState(false);
    const [cancelling, setCancelling] = React.useState(false);

    const handleManagePayments = () => {
        window.open('https://seentics.lemonsqueezy.com/billing', '_blank');
    };

    const handleCancel = async () => {
        if (!window.confirm('Are you sure you want to cancel your subscription? This will revert your account to the Starter plan at the end of the current billing cycle.')) {
            return;
        }

        try {
            setCancelling(true);
            const response = await api.post('/user/billing/cancel');
            if (response.data.success && response.data.data.url) {
                window.open(response.data.data.url, '_blank');
                toast.info('Please complete the cancellation in the billing portal.');
            }
        } catch {
            toast.error('Failed to initiate cancellation. Please try again.');
        } finally {
            setCancelling(false);
        }
    };

    if (loading) {
        return (
            <div className="p-4 sm:p-6 flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
            </div>
        );
    }

    const currentPlan = subscription?.plan || 'starter';
    const planPrice = subscription?.isCustomPlan && subscription?.priceMonthly
        ? subscription.priceMonthly
        : planPriceMap[currentPlan] ?? 0;
    const isStarter = currentPlan === 'starter';

    const usageItems = [
        { name: 'Monthly Events', key: 'monthlyEvents', icon: BarChart3, current: subscription?.usage?.monthlyEvents?.current || 0, limit: subscription?.usage?.monthlyEvents?.limit || 10000 },
        { name: 'Websites', key: 'websites', icon: Globe, current: subscription?.usage?.websites?.current || 0, limit: subscription?.usage?.websites?.limit || 1 },
        { name: 'Funnels', key: 'funnels', icon: Filter, current: subscription?.usage?.funnels?.current || 0, limit: subscription?.usage?.funnels?.limit || 1 },
        { name: 'Automations', key: 'workflows', icon: Workflow, current: subscription?.usage?.workflows?.current || 0, limit: subscription?.usage?.workflows?.limit || 1 },
        { name: 'Heatmaps', key: 'heatmaps', icon: Map, current: subscription?.usage?.heatmaps?.current || 0, limit: subscription?.usage?.heatmaps?.limit || 3 },
        { name: 'Session Recordings', key: 'replays', icon: Video, current: subscription?.usage?.replays?.current || 0, limit: subscription?.usage?.replays?.limit || 100 },
    ];

    const formatNumber = (n: number) => {
        if (n >= 1_000_000) { const v = n / 1_000_000; return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}M`; }
        if (n >= 1_000) { const v = n / 1_000; return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}K`; }
        return n.toString();
    };

    return (
        <div className="max-w-[1440px] mx-auto p-4 sm:p-8 space-y-8 animate-in fade-in duration-500">
            <DashboardPageHeader
                title="Billing & Subscription"
                description="Manage your subscription, usage limits, and billing details."
            />

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Left column */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Current Plan */}
                    <Card className="border border-border/60 bg-card shadow-sm">
                        <CardContent className="p-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-medium text-muted-foreground">Current Plan</span>
                                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                            Active
                                        </span>
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <h2 className="text-3xl font-bold tracking-tight">${planPrice}</h2>
                                        <span className="text-sm text-muted-foreground">/month</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1 capitalize">{currentPlan} Plan — {planDescriptions[currentPlan] || ''}</p>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <Button
                                    size="sm"
                                    onClick={() => setIsUpgradeModalOpen(true)}
                                    className="gap-1.5 text-xs font-medium"
                                >
                                    <Zap className="h-3.5 w-3.5" />
                                    {isStarter ? 'Upgrade Plan' : 'Change Plan'}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleManagePayments}
                                    className="gap-1.5 text-xs font-medium"
                                >
                                    <CreditCard className="h-3.5 w-3.5" />
                                    Manage Payments
                                </Button>
                                {!isStarter && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleCancel}
                                        disabled={cancelling}
                                        className="text-xs font-medium text-muted-foreground hover:text-red-500"
                                    >
                                        {cancelling ? 'Processing...' : 'Cancel Subscription'}
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Usage */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold">Usage</h3>
                        <div className="grid md:grid-cols-2 gap-3">
                            {usageItems.filter(r => r.limit !== 0).map((resource) => {
                                const percentage = getUsagePercentage(resource.key as any);
                                const Icon = resource.icon;
                                const isUnlimited = resource.limit === -1;
                                const isNear = percentage >= 80 && !isUnlimited;
                                const isAt = percentage >= 100 && !isUnlimited;

                                return (
                                    <Card key={resource.name} className="border border-border/60 bg-card shadow-sm">
                                        <CardContent className="p-4">
                                            <div className="flex items-center gap-2.5 mb-3">
                                                <div className="h-8 w-8 rounded-lg bg-primary/5 flex items-center justify-center">
                                                    <Icon className="h-4 w-4 text-primary" />
                                                </div>
                                                <span className="text-sm font-medium">{resource.name}</span>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-baseline">
                                                    <span className="text-lg font-semibold">{formatNumber(resource.current)}</span>
                                                    <span className="text-xs text-muted-foreground">
                                                        of {isUnlimited ? 'Unlimited' : formatNumber(resource.limit)}
                                                    </span>
                                                </div>
                                                <Progress
                                                    value={isUnlimited ? 0 : Math.min(percentage, 100)}
                                                    className={cn("h-1.5", isAt ? '[&>div]:bg-red-500' : isNear ? '[&>div]:bg-amber-500' : '')}
                                                />
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Right column */}
                <div className="space-y-6">
                    {/* Included Features */}
                    <Card className="border border-border/60 bg-card shadow-sm">
                        <CardContent className="p-5">
                            <h4 className="text-sm font-semibold mb-4">
                                Included in <span className="capitalize">{subscription?.isCustomPlan ? 'Custom' : currentPlan}</span>
                            </h4>
                            <ul className="space-y-3">
                                {(planFeatures[currentPlan] || planFeatures.starter).map((feature, i) => (
                                    <li key={i} className="flex items-start gap-2.5 text-xs text-muted-foreground">
                                        <div className="h-4 w-4 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                                            <Check className="h-2.5 w-2.5 text-emerald-500" />
                                        </div>
                                        <span className="leading-relaxed">{feature}</span>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>

                    {/* Support */}
                    <Card className="border border-border/60 bg-card shadow-sm">
                        <CardContent className="p-5 space-y-4">
                            <h4 className="text-sm font-semibold">Billing Support</h4>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Need a custom invoice or have questions about your billing?
                            </p>
                            <div className="p-3 rounded-lg bg-muted/30 border border-border/40">
                                <p className="text-xs text-muted-foreground mb-0.5">Contact</p>
                                <p className="text-sm font-medium text-primary">billing@seentics.com</p>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full gap-1.5 text-xs font-medium"
                                onClick={handleManagePayments}
                            >
                                <ExternalLink className="h-3.5 w-3.5" />
                                View Invoices
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <UpgradePlanModal
                isOpen={isUpgradeModalOpen}
                onClose={() => setIsUpgradeModalOpen(false)}
                currentPlan={currentPlan as any}
                limitType="monthlyEvents"
                currentUsage={subscription?.usage?.monthlyEvents?.current || 0}
                limit={subscription?.usage?.monthlyEvents?.limit || 10000}
            />
        </div>
    );
}
