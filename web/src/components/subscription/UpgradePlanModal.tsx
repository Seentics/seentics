'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/stores/useAuthStore';
import { startCheckout } from '@/lib/checkout';
import { isEnterprise } from '@/lib/features';
import { usePlans } from '@/features/plans/queries';
import { PLAN_FAMILY_LABEL, planFamily } from '@/features/plans/types';
import type { Plan, PlanFamily } from '@/features/plans/types';

type LimitType = 'websites' | 'workflows' | 'funnels' | 'heatmaps' | 'replays' | 'monthlyEvents' | 'aiAnalyses';

interface UpgradePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: string;
  /** Set only when the customer has actually hit a limit: the modal then says which. */
  limitType?: LimitType;
  currentUsage?: number;
  limit?: number;
}

const LIMIT_LABEL: Record<LimitType, string> = {
  websites: 'websites',
  workflows: 'automations',
  funnels: 'funnels',
  heatmaps: 'heatmap pages',
  replays: 'session recordings',
  monthlyEvents: 'monthly events',
  aiAnalyses: 'AI analyses',
};

const FAMILIES: Array<{ family: PlanFamily; blurb: string }> = [
  { family: 'suite', blurb: 'Analytics and Observability together' },
  { family: 'core', blurb: 'Web analytics, session replay, heatmaps, funnels and AI' },
];

const formatNum = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return n.toLocaleString();
};

const tierName = (plan: Plan) => `${plan.tier.charAt(0).toUpperCase()}${plan.tier.slice(1)}`;

/** The first two allowances, as one plain line: what the plan gives, without a feature grid. */
const summary = (plan: Plan) => plan.features.slice(0, 2).join(' · ');

/**
 * Choose or change a plan. Prices, names and allowances all come from the gateway's plan catalogue.
 * Someone already paying is switched in place (prorated); someone who is not goes to checkout.
 */
export const UpgradePlanModal: React.FC<UpgradePlanModalProps> = ({
  isOpen,
  onClose,
  currentPlan,
  limitType,
  currentUsage = 0,
  limit = 0,
}) => {
  if (!isEnterprise) return null;

  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { data: allPlans, isLoading } = usePlans();
  const [busyPlan, setBusyPlan] = React.useState<string | null>(null);

  const currentId = currentPlan === 'free' ? 'core-free' : currentPlan;
  const paid = (allPlans ?? []).filter((p) => p.priceMonthly > 0 && (planFamily(p) === 'suite' || planFamily(p) === 'core'));
  const currentPrice = (allPlans ?? []).find((p) => p.id === currentId)?.priceMonthly ?? 0;
  const limitHit = limitType !== undefined && limit > 0 && currentUsage >= limit;

  const choose = async (plan: Plan) => {
    if (!isAuthenticated) {
      window.location.href = '/signin';
      return;
    }
    try {
      setBusyPlan(plan.id);
      const result = await startCheckout(plan.id);
      // Already paying for these products: switched in place and prorated, so there is no checkout.
      if (result.kind === 'changed') {
        toast.success('Plan changed. The difference is prorated on your bill.');
        onClose();
        router.refresh();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.response?.data?.message || 'Could not start the change. Please try again.');
    } finally {
      setBusyPlan(null);
    }
  };

  const actionLabel = (plan: Plan) => {
    if (currentPrice === 0) return 'Choose';
    return plan.priceMonthly > currentPrice ? 'Upgrade' : plan.priceMonthly < currentPrice ? 'Downgrade' : 'Switch';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[92vh] w-[95vw] max-w-2xl overflow-y-auto overflow-x-hidden [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">{limitHit ? 'Upgrade your plan' : 'Change plan'}</DialogTitle>
          <DialogDescription>
            {limitHit && limitType ? (
              <>
                You&apos;re using{' '}
                <span className="font-medium text-foreground">
                  {formatNum(currentUsage)} of {formatNum(limit)}
                </span>{' '}
                {LIMIT_LABEL[limitType]}. A bigger plan lifts the limit.
              </>
            ) : (
              'Billed monthly. Changes are prorated, and you can cancel any time.'
            )}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading &&
          FAMILIES.map(({ family, blurb }) => {
            const rows = paid.filter((p) => planFamily(p) === family).sort((a, b) => a.priceMonthly - b.priceMonthly);
            if (rows.length === 0) return null;
            return (
              <section key={family} className="mt-2 min-w-0">
                <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
                  <h3 className="shrink-0 text-sm font-semibold">{PLAN_FAMILY_LABEL[family]}</h3>
                  <p className="hidden min-w-0 truncate text-xs text-muted-foreground sm:block">{blurb}</p>
                </div>
                <ul className="divide-y divide-border">
                  {rows.map((plan) => {
                    const isCurrent = plan.id === currentId;
                    return (
                      <li key={plan.id} className="flex items-center gap-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">
                            {tierName(plan)}
                            {isCurrent && (
                              <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
                                <Check className="h-3 w-3" /> Your plan
                              </span>
                            )}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{summary(plan)}</p>
                        </div>
                        <p className="shrink-0 text-sm tabular-nums">
                          <span className="font-semibold">${plan.priceMonthly}</span>
                          <span className="text-xs text-muted-foreground"> /mo</span>
                        </p>
                        <Button
                          size="sm"
                          variant={isCurrent ? 'ghost' : plan.priceMonthly > currentPrice ? 'default' : 'outline'}
                          disabled={isCurrent || busyPlan !== null}
                          onClick={() => choose(plan)}
                          className="w-28 shrink-0 text-xs"
                        >
                          {busyPlan === plan.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isCurrent ? 'Current' : actionLabel(plan)}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
      </DialogContent>
    </Dialog>
  );
};
