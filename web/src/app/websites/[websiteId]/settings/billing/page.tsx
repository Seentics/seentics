'use client';

import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  CreditCard,
  Check,
  Zap,
  BarChart3,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { useParams, useRouter } from 'next/navigation';
import { isEnterprise } from '@/lib/features';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { cn } from '@/lib/utils';

const planPrices: Record<string, number> = {
  starter: 0,
  growth: 29,
  pro: 79,
  enterprise: 399,
};

const planFeatures: Record<string, string[]> = {
  starter: ['Analytics Dashboard', '10K Monthly Events', '1 Website', '1 Funnel', '1 Automation', '3 Heatmaps', '100 Session Recordings', 'Community Support'],
  growth: ['Analytics Dashboard', '200K Monthly Events', '3 Websites', '10 Funnels', '10 Automations', 'Unlimited Heatmaps', '10,000 Session Recordings', 'Email Support'],
  pro: ['Analytics Dashboard', '2M Monthly Events', '15 Websites', 'Unlimited Funnels', 'Unlimited Automations', 'Unlimited Heatmaps', '50,000 Session Recordings', 'Priority Support'],
  enterprise: ['Analytics Dashboard', '15M Monthly Events', '100 Websites', 'Unlimited Funnels', 'Unlimited Automations', 'Unlimited Heatmaps', '200,000 Session Recordings', 'Dedicated Support'],
};

export default function BillingSettings() {
  const params = useParams();
  const websiteId = params?.websiteId as string;
  const router = useRouter();

  useEffect(() => {
    if (!isEnterprise) {
      router.replace(`/websites/${websiteId}/settings`);
    }
  }, [router, websiteId]);

  if (!isEnterprise) return null;
  const { subscription, loading, getUsagePercentage } = useSubscription();

  if (loading) {
    return (
      <div className="p-4 sm:p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
      </div>
    );
  }

  const currentPlan = subscription?.plan || 'starter';
  const price = planPrices[currentPlan] ?? 0;
  const eventsPercentage = getUsagePercentage('monthlyEvents');
  const currentEvents = subscription?.usage?.monthlyEvents?.current || 0;
  const limitEvents = subscription?.usage?.monthlyEvents?.limit || 10000;
  const isUnlimited = limitEvents === -1;

  const formatNumber = (n: number) => {
    if (n >= 1_000_000) { const v = n / 1_000_000; return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}M`; }
    if (n >= 1_000) { const v = n / 1_000; return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}K`; }
    return n.toString();
  };

  return (
    <div className="p-4 sm:p-8 space-y-8 animate-in fade-in duration-500 max-w-[1440px] mx-auto">
      <DashboardPageHeader
        title="Billing & Plans"
        description="Manage your subscription and track usage."
      >
        <Button variant="outline" size="sm" className="gap-1.5 text-xs font-medium"
          onClick={() => window.open('https://seentics.lemonsqueezy.com/billing', '_blank')}
        >
          <CreditCard className="h-3.5 w-3.5" />
          Manage Payments
        </Button>
      </DashboardPageHeader>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Plan + Usage */}
        <div className="lg:col-span-2 space-y-6">
          {/* Current Plan */}
          <Card className="border border-border/60 bg-card shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-muted-foreground">Current Plan</span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  Active
                </span>
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <h2 className="text-3xl font-bold tracking-tight">${price}</h2>
                <span className="text-sm text-muted-foreground">/month</span>
              </div>
              <p className="text-xs text-muted-foreground capitalize">{currentPlan} Plan</p>

              <div className="flex flex-wrap gap-2 mt-5">
                <Button size="sm" className="gap-1.5 text-xs font-medium"
                  onClick={() => router.push(`/websites/${websiteId}/billing`)}
                >
                  <Zap className="h-3.5 w-3.5" />
                  {currentPlan === 'starter' ? 'Upgrade Plan' : 'Change Plan'}
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs font-medium"
                  onClick={() => window.open('https://seentics.lemonsqueezy.com/billing', '_blank')}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View Invoices
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Usage */}
          <Card className="border border-border/60 bg-card shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="h-8 w-8 rounded-lg bg-primary/5 flex items-center justify-center">
                  <BarChart3 className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm font-medium">Monthly Events</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-lg font-semibold">{formatNumber(currentEvents)}</span>
                  <span className="text-xs text-muted-foreground">
                    of {isUnlimited ? 'Unlimited' : formatNumber(limitEvents)}
                  </span>
                </div>
                <Progress
                  value={isUnlimited ? 0 : Math.min(eventsPercentage, 100)}
                  className={cn(
                    "h-1.5",
                    eventsPercentage >= 100 && !isUnlimited ? '[&>div]:bg-red-500' :
                    eventsPercentage >= 80 && !isUnlimited ? '[&>div]:bg-amber-500' : ''
                  )}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Features */}
        <Card className="border border-border/60 bg-card shadow-sm">
          <CardContent className="p-5">
            <h4 className="text-sm font-semibold mb-4">
              Included in <span className="capitalize">{currentPlan}</span>
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
      </div>
    </div>
  );
}
