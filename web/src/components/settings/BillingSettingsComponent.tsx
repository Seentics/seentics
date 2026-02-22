'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Zap, Check, BarChart3, Shield, Filter, Workflow } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useSubscription } from '@/hooks/useSubscription';
import { UpgradePlanModal } from '@/components/subscription/UpgradePlanModal';
import Link from 'next/link';
import { toast } from 'sonner';
import api from '@/lib/api';
import { isEnterprise } from '@/lib/features';

export function BillingSettingsComponent() {
  if (!isEnterprise) return null;
  const { subscription, getUsagePercentage, refetch } = useSubscription();
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = React.useState(false);
  const [cancelling, setCancelling] = React.useState(false);

  const normalizedPlan = (subscription?.plan || 'Starter').toLowerCase();
  const isStarter = normalizedPlan === 'starter' || normalizedPlan === 'free';

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

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Billing & Subscription</h2>
          <p className="text-muted-foreground text-sm">Manage your plan, usage limits, and financial data.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Current Plan Card */}
          <div className="p-8 rounded bg-gradient-to-br from-primary/10 via-indigo-500/5 to-transparent border border-primary/20 relative overflow-hidden group shadow-2xl shadow-primary/5">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
              <Zap className="h-32 w-32 text-primary" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="px-4 py-1.5 rounded-full bg-primary text-white font-black text-[10px] uppercase tracking-[0.2em]">
                    {subscription?.plan || 'Starter'}
                </div>
                <div className="px-4 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 font-black text-[10px] uppercase tracking-[0.2em] border border-emerald-500/20">
                    Active Status
                </div>
              </div>
              <div className="flex items-baseline gap-2 mb-8">
                <h3 className="text-5xl font-black tracking-tight">${normalizedPlan.includes('starter') ? '0' : normalizedPlan.includes('growth') ? '29' : normalizedPlan.includes('pro') ? '79' : normalizedPlan.includes('enterprise') ? '249' : '0'}</h3>
                <span className="text-lg font-bold text-muted-foreground">/ month</span>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button 
                  onClick={() => setIsUpgradeModalOpen(true)}
                  className="h-12 px-8 font-black rounded shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90 transition-all active:scale-95"
                >
                  Change Plan
                </Button>
                <Link href="https://seentics.lemonsqueezy.com/billing" target="_blank">
                  <Button variant="outline" className="h-12 px-8 font-black rounded border-2 hover:bg-muted/50 transition-all">
                    Manage Payments
                  </Button>
                </Link>
                {!isStarter && (
                  <Button 
                    variant="ghost" 
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="h-12 px-6 font-bold text-red-500 hover:text-red-600 hover:bg-red-50 transition-all"
                  >
                    {cancelling ? 'Processing...' : 'Cancel Subscription'}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Usage Limits Section */}
          <div className="space-y-6">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground px-1">Resource Consumption</h3>
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
                  name: 'Connected Sites',
                  key: 'websites',
                  icon: Shield,
                  current: subscription?.usage?.websites?.current || 0,
                  limit: subscription?.usage?.websites?.limit || 1
                },
                {
                  name: 'Active Funnels',
                  key: 'funnels',
                  icon: Filter,
                  current: subscription?.usage?.funnels?.current || 0,
                  limit: subscription?.usage?.funnels?.limit || 1
                },
                {
                  name: 'Heatmaps',
                  key: 'heatmaps',
                  icon: BarChart3,
                  current: subscription?.usage?.heatmaps?.current || 0,
                  limit: subscription?.usage?.heatmaps?.limit || 0
                },
                {
                  name: 'Automations',
                  key: 'workflows',
                  icon: Workflow,
                  current: subscription?.usage?.workflows?.current || 0,
                  limit: subscription?.usage?.workflows?.limit || 1
                },
              ].map((resource) => {
                const percentage = getUsagePercentage(resource.key as any);
                const Icon = resource.icon;
                const isUnlimited = resource.limit === -1;

                return (
                  <Card key={resource.name} className="border-border/50 bg-card/50 backdrop-blur-sm rounded p-6 hover:shadow-lg transition-all group overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-10 transition-opacity">
                        <Icon size={48} />
                    </div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2.5 rounded bg-primary/10 text-primary border border-primary/10">
                        <Icon size={16} />
                      </div>
                      <span className="font-black text-[13px] uppercase tracking-wider">{resource.name}</span>
                    </div>
                    <div className="space-y-4">
                      <div className="flex justify-between items-baseline">
                        <span className="text-2xl font-black">{resource.current.toLocaleString()}</span>
                        <span className="text-[10px] font-black text-muted-foreground uppercase opacity-60">
                          {isUnlimited ? 'UNLIMITED' : `OF ${resource.limit.toLocaleString()}`}
                        </span>
                      </div>
                      <Progress value={isUnlimited ? 0 : percentage} className="h-2.5 rounded-full bg-muted/30" />
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Plan Features Card */}
          <div className="bg-card p-8 rounded border border-border/5 relative overflow-hidden group shadow-2xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[50px] rounded-full -mr-16 -mt-16" />
            <h4 className="text-foreground text-lg font-black mb-6 relative z-10 uppercase tracking-tight">Included Perks</h4>
            <ul className="space-y-4 relative z-10">
              {(subscription?.features || [
                'Basic analytics dashboard',
                'Community support',
                'Standard data retention'
              ]).map((f, i) => (
                <li key={i} className="flex items-start gap-3 text-xs font-bold text-muted-foreground">
                  <div className="w-5 h-5 rounded bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-500/20">
                    <Check className="h-3 w-3 text-emerald-500" />
                  </div>
                  <span className="leading-relaxed">{f}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Support & Billing Info */}
          <div className="p-8 rounded border border-border/50 bg-muted/5 space-y-6">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Support & Invoices</h4>
            <div className="space-y-6">
                <p className="text-xs font-medium text-muted-foreground leading-relaxed">
                    Need a custom invoice or have questions about your subscription?
                </p>
                <div className="p-4 rounded bg-background border border-border/50">
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Billing Support</p>
                    <p className="text-sm font-bold">billing@seentics.com</p>
                </div>
                <Button variant="ghost" className="w-full h-10 font-black text-[11px] uppercase tracking-widest border border-dashed hover:bg-muted">
                    Open Support Ticket
                </Button>
            </div>
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
