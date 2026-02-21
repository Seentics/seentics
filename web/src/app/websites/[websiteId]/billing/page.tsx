'use client';

import React, { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CreditCard, Zap, Check, Shield, BarChart3, Filter, Workflow, Loader2, Map, Video } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useSubscription } from '@/hooks/useSubscription';
import Link from 'next/link';
import { toast } from 'sonner';
import { UpgradePlanModal } from '@/components/subscription/UpgradePlanModal';
import { createPortalSession } from '@/lib/billing-api';
import api from '@/lib/api';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { isEnterprise } from '@/lib/features';

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
    const { subscription, loading, error, getUsagePercentage } = useSubscription();
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = React.useState(false);
    const [cancelling, setCancelling] = React.useState(false);

    const handleManagePayments = async () => {
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
        } catch (error) {
            toast.error('Failed to initiate cancellation. Please try again.');
        } finally {
            setCancelling(false);
        }
    };

    if (loading) {
        return (
            <div className="p-4 sm:p-6 flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const normalizedPlan = (subscription?.plan || 'Starter').toLowerCase();
    const isActive = subscription?.isActive;
    const isCustomPlan = subscription?.isCustomPlan;

    // Get price: use priceMonthly from API for custom plans, otherwise map from plan name
    const planPrice = isCustomPlan && subscription?.priceMonthly
        ? subscription.priceMonthly
        : (normalizedPlan.includes('starter') || normalizedPlan.includes('free')) ? 0 :
          normalizedPlan.includes('growth') ? 15 :
          normalizedPlan.includes('scale') ? 39 : 99;

    return (
        <div className="max-w-[1440px] mx-auto p-4 sm:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <DashboardPageHeader
                title="Billing & Subscription"
                description="Manage your subscription, usage limits, and billing details."
            />

            <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    {/* Current Plan Card */}
                    <div className="p-8 rounded bg-card/50 border border-border dark:border-none relative overflow-hidden group shadow-2xl shadow-primary/5">
                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
                            <Zap className="h-32 w-32 text-primary" />
                        </div>
                        <div className="relative z-10">
                            <Badge className="mb-6 bg-primary text-white border-none font-black text-[10px] uppercase tracking-[0.2em] px-4 h-7 rounded-full">
                                Active: {isCustomPlan ? 'Custom' : (subscription?.plan || 'Starter')} Plan
                            </Badge>
                            <div className="flex flex-col md:flex-row md:items-end gap-2 mb-8">
                                <h2 className="text-5xl font-black tracking-tight">
                                    ${planPrice}
                                </h2>
                                <span className="text-lg font-bold text-muted-foreground mb-1">/ month</span>
                            </div>

                            <div className="flex flex-wrap gap-3">
                                <Button
                                    onClick={() => setIsUpgradeModalOpen(true)}
                                    className="h-12 px-8 font-black rounded shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90"
                                >
                                    Change Plan
                                </Button>
                                <Button
                                    variant="outline"
                                    className="h-12 px-8 font-black rounded border-2 hover:bg-muted/50"
                                    onClick={handleManagePayments}
                                >
                                    Manage Payments
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Usage Limits Section */}
                    <div className="space-y-6">
                        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground px-1">Usage Tracker</h3>
                        <div className="grid md:grid-cols-2 gap-4">
                            {[
                                {
                                    name: 'Monthly Events',
                                    key: 'monthlyEvents',
                                    icon: BarChart3,
                                    current: subscription?.usage?.monthlyEvents?.current || 0,
                                    limit: subscription?.usage?.monthlyEvents?.limit || 5000
                                },
                                {
                                    name: 'Websites',
                                    key: 'websites',
                                    icon: Shield,
                                    current: subscription?.usage?.websites?.current || 0,
                                    limit: subscription?.usage?.websites?.limit || 1
                                },
                                {
                                    name: 'Funnels',
                                    key: 'funnels',
                                    icon: Filter,
                                    current: subscription?.usage?.funnels?.current || 0,
                                    limit: subscription?.usage?.funnels?.limit || 1
                                },
                                {
                                    name: 'Automations',
                                    key: 'workflows',
                                    icon: Workflow,
                                    current: subscription?.usage?.workflows?.current || 0,
                                    limit: subscription?.usage?.workflows?.limit || 1
                                },
                                {
                                    name: 'Heatmaps',
                                    key: 'heatmaps',
                                    icon: Map,
                                    current: subscription?.usage?.heatmaps?.current || 0,
                                    limit: subscription?.usage?.heatmaps?.limit || 1
                                },
                                {
                                    name: 'Session Recordings',
                                    key: 'replays',
                                    icon: Video,
                                    current: subscription?.usage?.replays?.current || 0,
                                    limit: subscription?.usage?.replays?.limit || 3
                                },
                            ].filter(resource => resource.limit !== 0).map((resource) => {
                                const percentage = getUsagePercentage(resource.key as any);
                                const Icon = resource.icon;
                                const isUnlimited = resource.limit === -1;

                                return (
                                    <Card key={resource.name} className="border-muted-foreground/10 dark:bg-gray-800/50 backdrop-blur-sm rounded p-6 hover:shadow-lg transition-shadow">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="p-2.5 rounded bg-primary/10 text-primary">
                                                <Icon size={18} />
                                            </div>
                                            <span className="font-black text-sm">{resource.name}</span>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-end">
                                                <span className="text-2xl font-black">{resource.current.toLocaleString()}</span>
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                                    OF {isUnlimited ? '∞' : resource.limit.toLocaleString()}
                                                </span>
                                            </div>
                                            <Progress value={isUnlimited ? 0 : percentage} className="h-2 rounded-full bg-muted/20" />
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="space-y-8">
                    {/* Plan Features Card */}
                    <div className="dark:bg-gray-800/50 p-8 rounded border border-white/5 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[50px] rounded-full -mr-16 -mt-16" />
                        <h4 className="text-white text-lg font-black mb-6 relative z-10 uppercase tracking-tight">Included in {isCustomPlan ? 'Custom' : (subscription?.plan || 'Starter')}</h4>
                        <ul className="space-y-4 relative z-10">
                            {(subscription?.features || [
                                'Basic analytics dashboard',
                                'Community support',
                                'Standard data retention'
                            ]).map((f, i) => (
                                <li key={i} className="flex items-start gap-3 text-xs font-bold text-slate-400">
                                    <div className="w-5 h-5 rounded bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                        <Check className="h-3 w-3 text-emerald-500" />
                                    </div>
                                    <span className="leading-relaxed">{f}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Support & Billing Info */}
                    <div className="p-8 rounded border border-muted-foreground/10 bg-muted/5 space-y-6">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Invoices & Receipts</h4>
                        <p className="text-xs font-medium text-muted-foreground leading-relaxed">
                            Need a custom invoice or have questions about your billing?
                            Contact our support team at <span className="text-primary font-black">billing@seentics.com</span>
                        </p>
                        <Button variant="ghost" className="w-full justify-start px-0 text-primary font-black text-xs hover:bg-transparent hover:underline">
                            Request Billing Support
                        </Button>
                    </div>
                </div>
            </div>

            <UpgradePlanModal 
                isOpen={isUpgradeModalOpen}
                onClose={() => setIsUpgradeModalOpen(false)}
                currentPlan={normalizedPlan as any}
                limitType="monthlyEvents"
                currentUsage={subscription?.usage?.monthlyEvents?.current || 0}
                limit={subscription?.usage?.monthlyEvents?.limit || 5000}
            />
        </div>
    );
}
