'use client';

import React from 'react';
import { ArrowRight, Check, ChevronDown, Loader2, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePlans } from '@/features/plans/queries';
import type { Plan } from '@/features/plans/types';
import { COMPARE_GROUPS, TIER_PITCH, cardSectionsFor } from '@/features/plans/pricing-spec';
import { cn } from '@/lib/utils';

export interface PlanSelection {
  /** A real plan id from gateway's catalog (`free`, `pro`) — gateway validates it at checkout. */
  plan: string;
  price: number;
}

interface PlanBuilderProps {
  onSubscribe?: (selection: PlanSelection) => void;
  loading?: boolean;
  /** The signed-in account's plan id; a visitor has none. */
  currentPlan?: string;
}

/**
 * Free and Pro, from gateway's GET /api/v1/plans: two cards with one short list each
 * (pricing-spec.ts), and the full comparison behind "Compare all features".
 */
export function PlanBuilder({ onSubscribe, loading, currentPlan }: PlanBuilderProps) {
  const { data: plans, isLoading, isError } = usePlans();
  const [comparing, setComparing] = React.useState(false);
  const [loadingPlan, setLoadingPlan] = React.useState<string | null>(null);

  const handleSubscribe = (plan: Plan) => {
    if (!onSubscribe) return;
    setLoadingPlan(plan.id);
    onSubscribe({ plan: plan.id, price: plan.priceMonthly });
  };

  const renderCard = (plan: Plan) => {
    const featured = plan.tier === 'pro';
    const isCurrent = !!currentPlan && currentPlan === plan.id;
    return (
      <div
        key={plan.id}
        className={cn(
          'relative flex flex-col rounded-2xl border bg-card p-7',
          featured ? 'border-primary shadow-lg shadow-primary/10 ring-1 ring-primary' : 'border-border',
        )}
      >
        {featured && (
          <span className="absolute -top-3 left-7 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground">
            Most popular
          </span>
        )}

        <h3 className="text-lg font-semibold">{plan.name}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{TIER_PITCH[plan.tier]}</p>

        <div className="mt-5 flex items-baseline gap-1">
          <span className="text-4xl font-bold tracking-tight">${plan.priceMonthly}</span>
          <span className="text-sm text-muted-foreground">/month</span>
        </div>

        <Button
          onClick={() => handleSubscribe(plan)}
          disabled={loading || isCurrent}
          variant={featured ? 'default' : 'outline'}
          className={cn('mt-4 w-full gap-1.5', !featured && 'bg-accent text-accent-foreground hover:bg-accent/70')}
        >
          {loading && loadingPlan === plan.id ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isCurrent ? (
            'Current plan'
          ) : (
            <>{featured ? 'Get Pro' : 'Start free'} <ArrowRight className="h-4 w-4" /></>
          )}
        </Button>

        <div className="mt-6 space-y-6 border-t border-border pt-6">
          {cardSectionsFor(plan).map((section) => (
            <div key={section.title}>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{section.title}</p>
              <ul className="space-y-2.5">
                {section.items.map((item) => (
                  <li key={item.label} className="flex gap-2.5 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>
                      {item.value && <span className="font-semibold text-foreground">{item.value} </span>}
                      <span className="text-muted-foreground">{item.label}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto w-full max-w-[52rem]">
      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {isError && (
        <p className="py-16 text-center text-sm text-muted-foreground">Couldn&apos;t load pricing right now. Please refresh the page.</p>
      )}

      {plans && (
        <>
          <div className="grid grid-cols-1 gap-6 pt-3 md:grid-cols-2">{plans.map(renderCard)}</div>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Both plans include Analytics, Session Replay and Observability. Extra usage is off until you turn it on, and a spend cap keeps it in budget.
          </p>

          <div className="mt-4 flex justify-center">
            <Button variant="ghost" onClick={() => setComparing((open) => !open)} aria-expanded={comparing} className="gap-1.5">
              {comparing ? 'Hide feature comparison' : 'Compare all features'}
              <ChevronDown className={cn('h-4 w-4 transition-transform', comparing && 'rotate-180')} />
            </Button>
          </div>

          {comparing && <CompareTable plans={plans} />}
        </>
      )}
    </div>
  );
}

function CompareTable({ plans }: { plans: Plan[] }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="w-2/5 px-5 py-4 text-left font-medium text-muted-foreground" />
            {plans.map((plan) => (
              <th key={plan.id} className={cn('px-4 py-4 text-center font-semibold', plan.tier === 'pro' && 'text-primary')}>
                {plan.name}
                <span className="block text-xs font-normal text-muted-foreground">${plan.priceMonthly}/mo</span>
              </th>
            ))}
          </tr>
        </thead>
        {COMPARE_GROUPS.map((group) => (
          <tbody key={group.title}>
            <tr className="bg-muted/40">
              <th colSpan={plans.length + 1} className="px-5 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.title}
              </th>
            </tr>
            {group.rows.map((row) => (
              <tr key={row.label} className="border-b border-border/60 last:border-0">
                <td className="px-5 py-3 text-muted-foreground">{row.label}</td>
                {plans.map((plan) => {
                  const value = row.value(plan);
                  return (
                    <td key={plan.id} className="px-4 py-3 text-center font-medium">
                      {value === true ? (
                        <Check className="mx-auto h-4 w-4 text-primary" aria-label="Included" />
                      ) : value === false ? (
                        <Minus className="mx-auto h-4 w-4 text-muted-foreground" aria-label="Not included" />
                      ) : (
                        value
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
