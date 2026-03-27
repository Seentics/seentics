'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, Crown, ArrowRight, X, Rocket, TrendingUp } from 'lucide-react';
import { useAuth } from '@/stores/useAuthStore';
import api from '@/lib/api';
import { openCheckout } from '@/lib/checkout';
import { isEnterprise } from '@/lib/features';
import { cn } from '@/lib/utils';

interface UpgradePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: string;
  limitType: 'websites' | 'workflows' | 'funnels' | 'heatmaps' | 'replays' | 'monthlyEvents';
  currentUsage: number;
  limit: number;
}

const planDetails = {
  basic: {
    name: 'Starter',
    priceMonthly: 9,
    priceYearly: 7,
    priceYearlyTotal: 84,
    icon: Rocket,
    color: 'teal',
    features: [
      'Unlimited Websites',
      '100,000 Monthly Events',
      '1,000 Session Recordings',
      '10 Heatmap Pages',
      '10 Funnels & 5 Automations',
      '1 Year Data Retention',
      'API & SDK Access',
      'Email Support',
    ],
    buttonText: 'Get Starter',
  },
  growth: {
    name: 'Growth',
    priceMonthly: 19,
    priceYearly: 15,
    priceYearlyTotal: 180,
    icon: TrendingUp,
    color: 'violet',
    popular: true,
    features: [
      'Unlimited Websites',
      '500,000 Monthly Events',
      '10,000 Session Recordings',
      'Unlimited Heatmaps',
      'Unlimited Funnels',
      '10 Automations',
      '2 Year Data Retention',
      'API & SDK Access',
      '3 Team Members',
      'Email Support',
    ],
    buttonText: 'Get Growth',
  },
  pro: {
    name: 'Pro',
    priceMonthly: 49,
    priceYearly: 39,
    priceYearlyTotal: 468,
    icon: Crown,
    color: 'amber',
    features: [
      'Unlimited Websites',
      '2,000,000 Monthly Events',
      '50,000 Session Recordings',
      'Unlimited Heatmaps',
      'Unlimited Funnels',
      'Unlimited Automations',
      '5 Year Data Retention',
      'API & SDK Access',
      'Unlimited Team Members',
      'Priority Support',
    ],
    buttonText: 'Get Pro',
  },
};

const limitMessages: Record<string, string> = {
  websites: "You've reached your website limit",
  workflows: "You've reached your automation limit",
  funnels: "You've reached your funnel limit",
  heatmaps: "You've reached your heatmap limit",
  replays: "You've reached your session recording limit",
  monthlyEvents: "You've reached your monthly events limit",
};

const limitLabels: Record<string, string> = {
  websites: 'websites',
  workflows: 'automations',
  funnels: 'funnels',
  heatmaps: 'heatmap pages',
  replays: 'session recordings',
  monthlyEvents: 'monthly events',
};

const formatNum = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return n.toLocaleString();
};

declare global {
  interface Window {
    createLemonSqueezy?: () => void;
    LemonSqueezy?: {
      Url: { Open: (url: string) => void };
      Setup: () => void;
    };
  }
}

const colorMap: Record<string, { bg: string; hover: string; check: string; border: string; light: string }> = {
  teal:   { bg: 'bg-teal-500',   hover: 'hover:bg-teal-600',   check: 'text-teal-500',   border: 'border-teal-500',   light: 'bg-teal-500/10' },
  violet: { bg: 'bg-indigo-500', hover: 'hover:bg-indigo-600', check: 'text-indigo-500', border: 'border-indigo-500', light: 'bg-indigo-500/10' },
  amber:  { bg: 'bg-amber-500',  hover: 'hover:bg-amber-600',  check: 'text-amber-500',  border: 'border-amber-500',  light: 'bg-amber-500/10' },
};

export const UpgradePlanModal: React.FC<UpgradePlanModalProps> = ({
  isOpen,
  onClose,
  currentPlan,
  limitType,
  currentUsage,
  limit,
}) => {
  if (!isEnterprise) return null;

  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [billing, setBilling] = React.useState<'monthly' | 'yearly'>('monthly');

  const normalizedPlan = currentPlan === 'free' ? 'starter' : currentPlan;
  const upgradePlans = (['basic', 'growth', 'pro'] as const).filter(p => p !== normalizedPlan);

  const handleUpgrade = async (plan: 'basic' | 'growth' | 'pro') => {
    if (!isAuthenticated) {
      window.location.href = '/signin';
      return;
    }

    try {
      setLoading(true);
      const response = await api.post('/user/billing/checkout', { plan, billing });

      if (response.data.success && response.data.data.checkoutUrl) {
        onClose();
        openCheckout(response.data.data.checkoutUrl);
      } else {
        throw new Error(response.data.message || 'Failed to create checkout session');
      }
    } catch (error: any) {
      console.error('Upgrade error:', error);
      alert(error.response?.data?.message || 'Failed to start upgrade process. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto w-[95vw]">
        <DialogHeader className="relative pb-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="absolute right-0 top-0 h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
          <DialogTitle className="text-xl font-semibold text-center">
            Upgrade Your Plan
          </DialogTitle>
          <div className="text-center mt-1.5">
            <p className="text-sm text-red-500 font-medium mb-1">
              {limitMessages[limitType]}
            </p>
            <p className="text-xs text-muted-foreground">
              You're using{' '}
              <span className="font-medium text-foreground">
                {formatNum(currentUsage)} of {formatNum(limit)}
              </span>{' '}
              {limitLabels[limitType] ?? limitType}. Upgrade to continue growing.
            </p>
          </div>
        </DialogHeader>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3 mt-5">
          <button
            onClick={() => setBilling('monthly')}
            className={cn(
              "text-sm font-medium transition-colors",
              billing === 'monthly' ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling(billing === 'monthly' ? 'yearly' : 'monthly')}
            className={cn(
              "relative w-10 h-5 rounded-full transition-colors focus:outline-none",
              billing === 'yearly' ? "bg-primary" : "bg-muted"
            )}
            aria-label="Toggle billing period"
          >
            <span className={cn(
              "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
              billing === 'yearly' && "translate-x-5"
            )} />
          </button>
          <button
            onClick={() => setBilling('yearly')}
            className={cn(
              "text-sm font-medium transition-colors flex items-center gap-1.5",
              billing === 'yearly' ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Yearly
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              Save 20%
            </span>
          </button>
        </div>

        <div className={cn(
          "grid gap-4 mt-5",
          upgradePlans.length === 3 ? "grid-cols-1 md:grid-cols-3" :
          upgradePlans.length === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"
        )}>
          {upgradePlans.map((planKey) => {
            const plan = planDetails[planKey];
            const PlanIcon = plan.icon;
            const colors = colorMap[plan.color];
            const displayPrice = billing === 'yearly' ? plan.priceYearly : plan.priceMonthly;

            return (
              <div key={planKey} className="relative">
                {'popular' in plan && plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <span className={cn("text-[10px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full text-white", colors.bg)}>
                      Most Popular
                    </span>
                  </div>
                )}

                <div className={cn(
                  "h-full flex flex-col rounded-xl border bg-card p-5 transition-all duration-200",
                  'popular' in plan && plan.popular
                    ? `border-2 ${colors.border} shadow-md`
                    : 'border-border/60'
                )}>
                  <div className="mb-4">
                    <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center mb-3", colors.light)}>
                      <PlanIcon className={cn("h-4 w-4", colors.check)} />
                    </div>
                    <h3 className="text-base font-semibold">{plan.name}</h3>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-2xl font-bold tracking-tight">${displayPrice}</span>
                      <span className="text-xs text-muted-foreground">/mo</span>
                    </div>
                    {billing === 'yearly' && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        ${plan.priceYearlyTotal}/yr
                        <span className="ml-1 text-emerald-600 font-medium">
                          Save ${(plan.priceMonthly - plan.priceYearly) * 12}/yr
                        </span>
                      </p>
                    )}
                  </div>

                  <ul className="space-y-2 flex-1 mb-5">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <CheckCircle className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", colors.check)} />
                        <span className="text-xs text-muted-foreground leading-tight">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => handleUpgrade(planKey)}
                    disabled={loading}
                    className={cn("w-full gap-1.5 text-xs font-medium text-white", colors.bg, colors.hover)}
                  >
                    {loading ? 'Processing...' : (
                      <>{plan.buttonText} <ArrowRight className="h-3.5 w-3.5" /></>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 pt-4 border-t border-border/50 text-center">
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-4 flex-wrap">
            <span>Cancel anytime</span>
            <span className="opacity-30">|</span>
            <span>30-day money back guarantee</span>
            <span className="opacity-30">|</span>
            <span>Instant upgrade</span>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
