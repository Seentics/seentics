'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { usePlans } from '@/features/plans/queries';
import type { Plan } from '@/features/plans/types';

import {
  ArrowRight, Loader2, Check, Zap, TrendingUp, Crown, Shield, type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PlanSelection {
  /** A real plan id from gateway's catalog, e.g. `core-free`/`suite-pro` — opaque here, gateway validates it at checkout. */
  plan: string;
  price: number;
  billing: 'monthly' | 'yearly';
}

interface PlanBuilderProps {
  onSubscribe?: (selection: PlanSelection) => void;
  loading?: boolean;
  currentPlan?: string;
  /** If true, shows agency plans instead of individual */
  mode?: 'individual' | 'agency';
}

/** Bold only the numbers that actually vary in a way worth calling out —
 *  the event cap and the Observability line (absent on two of the four
 *  tiers entirely). Session recordings, AI analyses etc. differ too, but
 *  they're not the plan's headline differentiator, so they stay regular
 *  weight rather than every line competing for attention. */
function isHeadlineFeature(feature: string): boolean {
  return feature.includes('Events / month') || feature.startsWith('Observability');
}

/**
 * Everything about a plan that's a data fact — price, limits, feature copy —
 * comes from gateway's GET /api/v1/plans (features/plans/*). Icon is purely
 * presentational and has no business living in the database, so it's the one
 * thing still keyed by plan id here. A plan id with no entry falls back to a
 * generic look rather than crashing the page.
 *
 * Color is deliberately NOT per-plan across the board (a rainbow strip on
 * every card read as gaudy) — but the two positioning badges ("Best for...")
 * are the one thing meant to grab the eye while scanning the row, so those
 * two (and only those two) keep a distinct accent on their badge + icon.
 * Every other card stays neutral, and `popular` gets the brand accent.
 */
const PLAN_PRESENTATION: Record<string, { icon: LucideIcon; popular?: boolean; badge?: string; color?: string; bgColor?: string }> = {
  'core-free': { icon: Zap },
  // First bundle tier — badged for the thing Free can't do at all: real
  // headroom plus Observability and Uptime, not a repeat of Free's pitch.
  'suite-pro': { icon: TrendingUp, badge: 'Best for Full Visibility', color: 'text-indigo-600 dark:text-indigo-400', bgColor: 'bg-indigo-500' },
  'suite-business': { icon: Crown, popular: true },
  'suite-enterprise': { icon: Shield },
};
const DEFAULT_PRESENTATION = { icon: Zap };

export function PlanBuilder({ onSubscribe, loading, currentPlan, mode = 'individual' }: PlanBuilderProps) {
  const { data: allPlans, isLoading, isError } = usePlans('core');
  // The marketing page sells the entry-point free tier plus the suite
  // bundles — a standalone `core-pro`/`core-business` (Core with none of
  // Observe/Uptime) exists in the catalog for API/checkout flexibility, but
  // showing it here next to a bundle at the same price would only read as a
  // strictly-worse option. See gateway/db/sql/014_multi_product_subscriptions.sql.
  const plans = allPlans?.filter((p) => p.tier === 'free' || p.isBundle);
  const [loadingPlan, setLoadingPlan] = React.useState<string | null>(null);

  const handleSubscribe = (plan: Plan) => {
    if (!onSubscribe) return;
    setLoadingPlan(plan.id);
    onSubscribe({ plan: plan.id as PlanSelection['plan'], price: plan.priceMonthly, billing: 'monthly' });
  };

  const renderCard = (plan: Plan) => {
    const presentation = PLAN_PRESENTATION[plan.id] ?? DEFAULT_PRESENTATION;
    const Icon = presentation.icon;
    const isCurrent = currentPlan === plan.id || (plan.id === 'core-free' && (currentPlan === 'free' || !currentPlan));
    const isFree = plan.priceMonthly === 0;
    const displayPrice = plan.priceMonthly;

    return (
      <div
        key={plan.id}
        className={cn(
          // No border/rounding/shadow of its own — the shared container owns
          // the outer border and the divider lines between columns, which is
          // the whole point of a squared, divided table over four separate
          // floating cards: at four-wide it's more width for content, not
          // more gap between cards.
          'relative flex flex-col p-6 sm:p-7 transition-colors duration-300',
          isCurrent && 'bg-primary/[0.03]',
        )}
      >
        {/* Identity strip — only the popular tier gets the brand accent, so
            it actually reads as a highlight instead of one of five colors. */}
        {presentation.popular && <div className="absolute inset-x-0 top-0 h-1 bg-primary" />}

        <div className="mb-5">
          {/* Fixed-height slot, always rendered — only 2 of 4 plans carry a
              badge, and letting it appear/disappear per-card was what threw
              title/price out of alignment across the row. Empty but present
              beats "sometimes there, sometimes not" here. */}
          <div className="mb-2 h-5">
            {(presentation.badge || presentation.popular) && (
              <span className={cn(
                'inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white',
                presentation.popular ? 'bg-primary' : presentation.bgColor ?? 'bg-muted-foreground',
              )}>
                {presentation.badge ?? 'Most Popular'}
              </span>
            )}
          </div>
          <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center mb-3', presentation.bgColor ? `${presentation.bgColor}/10` : 'bg-muted')}>
            <Icon className={cn('h-4 w-4', presentation.color ?? 'text-foreground')} />
          </div>
          <h3 className="text-2xl font-semibold">{plan.name}</h3>
          {/* Same reasoning as the badge slot: descriptions run 1-2 lines
              depending on the plan, and letting that vary pushed the price
              row below to a different height per card. */}
          <p className="mt-0.5 min-h-[2rem] text-xs leading-tight text-muted-foreground">{plan.description}</p>
        </div>

        <div className="flex items-baseline gap-1 mb-1.5">
          <span className="text-3xl font-bold tracking-tight">
            {isFree ? 'Free' : `$${displayPrice}`}
          </span>
          {!isFree && <span className="text-sm text-muted-foreground">/mo</span>}
        </div>
        <div className="mb-5" />

        <ul className="space-y-3 flex-1 mb-6">
          {plan.features.map((feature, i) => {
            const isHeadline = isHeadlineFeature(feature);
            return (
              <li key={i} className="flex items-start gap-2">
                <Check className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                <span className={cn('text-sm leading-snug', isHeadline ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                  {feature}
                </span>
              </li>
            );
          })}
        </ul>

        <Button
          onClick={() => handleSubscribe(plan)}
          disabled={loading || isCurrent}
          variant={presentation.popular ? 'default' : 'outline'}
          className={cn('w-full gap-1.5 text-xs font-medium', presentation.popular && 'shadow-md')}
        >
          {loading && loadingPlan === plan.id ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : isCurrent ? (
            'Current Plan'
          ) : isFree ? (
            <>Get Started <ArrowRight className="h-3.5 w-3.5" /></>
          ) : (
            <>Get {plan.name} <ArrowRight className="h-3.5 w-3.5" /></>
          )}
        </Button>
      </div>
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto">
      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {isError && (
        <p className="text-center text-sm text-muted-foreground py-16">
          Couldn&apos;t load pricing right now. Please refresh the page.
        </p>
      )}

      {plans && (
        <div className={cn(
          // One bordered, divided table instead of four separate cards with
          // gaps between them — square corners on every internal seam, only
          // the outer rectangle gets rounded. Frees up real width per column
          // since nothing is spent on inter-card gutters.
          'grid overflow-hidden rounded-2xl border border-border bg-card',
          'divide-y divide-border sm:divide-y-0 sm:divide-x',
          mode === 'agency' ? 'grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
        )}>
          {plans.map(renderCard)}
        </div>
      )}

      <div className="mt-8 text-center">
        <p className="text-xs text-muted-foreground flex items-center justify-center gap-4 flex-wrap">
          <span className="flex items-center gap-1"><Check className="h-3 w-3" /> Cancel anytime</span>
          <span className="flex items-center gap-1"><Check className="h-3 w-3" /> No hidden fees</span>
          <span className="flex items-center gap-1"><Check className="h-3 w-3" /> 30-day money back</span>
        </p>
      </div>
    </div>
  );
}
