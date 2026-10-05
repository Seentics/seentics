'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, Crown, ArrowRight, X, TrendingUp, Rocket, Loader2 } from 'lucide-react';
import { useAuth } from '@/stores/useAuthStore';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { openCheckout } from '@/lib/checkout';
import { isEnterprise } from '@/lib/features';
import { usePlans } from '@/features/plans/queries';
import { PLAN_FAMILY_LABEL, planFamily } from '@/features/plans/types';
import type { Plan } from '@/features/plans/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface UpgradePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: string;
  limitType: 'websites' | 'workflows' | 'funnels' | 'heatmaps' | 'replays' | 'monthlyEvents' | 'aiAnalyses';
  currentUsage: number;
  limit: number;
}

/**
 * Price, name and feature copy all come from gateway's GET /api/v1/plans
 * (features/plans/*) — same source PlanBuilder.tsx reads. Icon/color are
 * purely presentational, so they're keyed by tier here: every family has
 * the same four, and Pro is the highlighted pick.
 */
const TIER_PRESENTATION: Record<string, { icon: typeof Rocket; color: keyof typeof colorMap }> = {
  starter: { icon: Rocket, color: 'teal' },
  pro: { icon: TrendingUp, color: 'violet' },
  business: { icon: Crown, color: 'amber' },
};
const DEFAULT_PRESENTATION: { icon: typeof Rocket; color: keyof typeof colorMap } = { icon: Rocket, color: 'teal' };

/** "Suite Pro", "Analytics Starter". */
function planLabel(plan: Plan): string {
  return `${PLAN_FAMILY_LABEL[planFamily(plan)]} ${plan.tier.charAt(0).toUpperCase()}${plan.tier.slice(1)}`;
}

const TIER_RANK: Record<string, number> = { free: 0, starter: 1, pro: 2, business: 3 };

/** The `core` plan-limit key behind each limit the app can hit. */
const LIMIT_KEY: Record<string, string> = {
  websites: 'websites',
  workflows: 'automations',
  funnels: 'funnels',
  heatmaps: 'heatmaps',
  replays: 'replays',
  monthlyEvents: 'monthly_events',
  aiAnalyses: 'ai_analyses',
};

const limitMessages: Record<string, string> = {
  websites: "You've reached your website limit",
  workflows: "You've reached your automation limit",
  funnels: "You've reached your funnel limit",
  heatmaps: "You've reached your heatmap limit",
  replays: "You've reached your session recording limit",
  monthlyEvents: "You've reached your monthly events limit",
  aiAnalyses: "You've reached your AI analysis limit",
};

const limitLabels: Record<string, string> = {
  websites: 'websites',
  workflows: 'automations',
  funnels: 'funnels',
  heatmaps: 'heatmap pages',
  replays: 'session recordings',
  monthlyEvents: 'monthly events',
  aiAnalyses: 'AI analyses',
};

const formatNum = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return n.toLocaleString();
};

const colorMap = {
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

  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { data: allPlans, isLoading: plansLoading } = usePlans('core');
  const [loading, setLoading] = React.useState(false);
  const [waitingForPayment, setWaitingForPayment] = React.useState(false);

  const normalizedPlan = currentPlan === 'free' ? 'core-free' : currentPlan;
  const currentRank = TIER_RANK[(allPlans ?? []).find((p) => p.id === normalizedPlan)?.tier ?? 'free'] ?? 0;
  const limitKey = LIMIT_KEY[limitType];
  // The three cheapest plans — Analytics or Suite — that are a step up and
  // actually lift the limit that was just hit (Suite Pro doesn't help
  // someone at Analytics Pro's event cap, so it isn't offered for that).
  const upgradePlans = (allPlans ?? [])
    .filter((p) => p.priceMonthly > 0 && p.id !== normalizedPlan && (TIER_RANK[p.tier] ?? 0) > currentRank)
    .filter((p) => {
      if (!limitKey) return true;
      const value = p.limits.core?.[limitKey];
      return value === -1 || (value !== undefined && value > limit);
    })
    .sort((a, b) => a.priceMonthly - b.priceMonthly)
    .slice(0, 3);

  const handleUpgrade = async (planId: string) => {
    if (!isAuthenticated) {
      window.location.href = '/signin';
      return;
    }

    try {
      setLoading(true);
      const response = await api.post('/user/billing/checkout', { plan: planId });

      // Already paying for these products: the subscription was switched in
      // place, prorated — there is no checkout to open.
      if (response.data.success && response.data.data.changed) {
        toast.success('Plan changed. The difference is prorated on your bill.');
        onClose();
        router.refresh();
        return;
      }

      if (response.data.success && response.data.data.checkoutUrl) {
        openCheckout(
          response.data.data.checkoutUrl,
          () => {
            toast.success('Plan activated! Taking you to your dashboard…');
            onClose();
            router.push('/websites');
          },
          () => {
            toast.info('Payment received — your plan will activate shortly.');
            onClose();
            router.push('/websites');
          },
          () => setWaitingForPayment(true),
        );
      } else {
        throw new Error(response.data.message || 'Failed to create checkout session');
      }
    } catch (error: any) {
      console.error('Upgrade error:', error);
      toast.error(error.response?.data?.error || error.response?.data?.message || 'Failed to start upgrade process. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (waitingForPayment) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-sm">
          <div className="flex flex-col items-center text-center py-8 gap-4">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-7 w-7 text-primary animate-spin" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-1">Complete your payment</h3>
              <p className="text-sm text-muted-foreground">Finish the checkout in the tab that just opened. Your plan will activate automatically.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

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

        {plansLoading && (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!plansLoading && (
          <div className={cn(
            "grid gap-4 mt-5",
            upgradePlans.length === 3 ? "grid-cols-1 md:grid-cols-3" :
            upgradePlans.length === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"
          )}>
            {upgradePlans.map((plan) => {
              const presentation = TIER_PRESENTATION[plan.tier] ?? DEFAULT_PRESENTATION;
              const PlanIcon = presentation.icon;
              const colors = colorMap[presentation.color];
              const highlighted = plan.tier === 'pro';

              return (
                <div key={plan.id} className="relative">
                  {highlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                      <span className={cn("text-[10px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full text-white", colors.bg)}>
                        Most Popular
                      </span>
                    </div>
                  )}

                  <div className={cn(
                    "h-full flex flex-col rounded-lg border bg-card p-5 transition-all duration-200",
                    highlighted ? `border-2 ${colors.border} shadow-md` : 'border-border',
                  )}>
                    <div className="mb-4">
                      <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center mb-3", colors.light)}>
                        <PlanIcon className={cn("h-4 w-4", colors.check)} />
                      </div>
                      <h3 className="text-base font-semibold">{planLabel(plan)}</h3>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-2xl font-bold tracking-tight">${plan.priceMonthly}</span>
                        <span className="text-xs text-muted-foreground">/mo</span>
                      </div>
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
                      onClick={() => handleUpgrade(plan.id)}
                      disabled={loading}
                      className={cn("w-full gap-1.5 text-xs font-medium text-white", colors.bg, colors.hover)}
                    >
                      {loading ? 'Processing...' : (
                        <>{`Get ${planLabel(plan)}`} <ArrowRight className="h-3.5 w-3.5" /></>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-border text-center">
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
