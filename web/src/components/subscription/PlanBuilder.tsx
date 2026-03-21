'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  ArrowRight, Loader2, Check, Zap, Crown, Rocket, TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PlanSelection {
  plan: 'free' | 'basic' | 'growth' | 'pro';
  price: number;
  billing: 'monthly' | 'yearly';
}

interface PlanBuilderProps {
  onSubscribe?: (selection: PlanSelection) => void;
  loading?: boolean;
  currentPlan?: string;
}

const PLANS = [
  {
    id: 'free' as const,
    name: 'Starter',
    priceMonthly: 0,
    priceYearly: 0,
    description: 'For side projects and personal sites',
    icon: Zap,
    color: 'text-indigo-500',
    borderColor: 'border-indigo-500',
    bgColor: 'bg-indigo-500',
    features: [
      '1 Website',
      '10,000 Monthly Pageviews',
      '1 Funnel',
      '2 Goals',
      '30 Day Data Retention',
      'Community Support',
    ],
  },
  {
    id: 'basic' as const,
    name: 'Basic',
    priceMonthly: 7,
    priceYearly: 5,
    priceYearlyTotal: 60,
    description: 'For small businesses',
    icon: Rocket,
    color: 'text-teal-500',
    borderColor: 'border-teal-500',
    bgColor: 'bg-teal-500',
    features: [
      '3 Websites',
      '100,000 Monthly Pageviews',
      '5 Funnels',
      '10 Goals',
      'UTM Campaign Tracking',
      '1 Year Data Retention',
      'Email Support',
    ],
  },
  {
    id: 'growth' as const,
    name: 'Growth',
    priceMonthly: 14,
    priceYearly: 11,
    priceYearlyTotal: 132,
    description: 'For growing businesses',
    icon: TrendingUp,
    popular: true,
    color: 'text-indigo-500',
    borderColor: 'border-indigo-500',
    bgColor: 'bg-indigo-500',
    features: [
      '10 Websites',
      '500,000 Monthly Pageviews',
      'Unlimited Funnels',
      'Unlimited Goals',
      'UTM Campaign Tracking',
      'Geographic Map View',
      '2 Year Data Retention',
      'API Access',
      'Email Support',
    ],
  },
  {
    id: 'pro' as const,
    name: 'Pro',
    priceMonthly: 29,
    priceYearly: 23,
    priceYearlyTotal: 276,
    description: 'For scaling teams',
    icon: Crown,
    color: 'text-amber-500',
    borderColor: 'border-amber-500',
    bgColor: 'bg-amber-500',
    features: [
      'Unlimited Websites',
      '2,000,000 Monthly Pageviews',
      'Unlimited Funnels',
      'Unlimited Goals',
      'UTM Campaign Tracking',
      'Geographic Map View',
      '5 Year Data Retention',
      'API Access',
      'Team Management',
      'Priority Support',
    ],
  },
];

export function PlanBuilder({ onSubscribe, loading, currentPlan }: PlanBuilderProps) {
  const [loadingPlan, setLoadingPlan] = React.useState<string | null>(null);
  const [billing, setBilling] = React.useState<'monthly' | 'yearly'>('monthly');

  const handleSubscribe = (planId: 'free' | 'basic' | 'growth' | 'pro') => {
    if (!onSubscribe) return;
    const plan = PLANS.find(p => p.id === planId);
    if (!plan) return;
    setLoadingPlan(planId);
    const price = billing === 'yearly' ? (plan.priceYearly ?? plan.priceMonthly) : plan.priceMonthly;
    onSubscribe({ plan: planId, price, billing });
  };

  const renderCard = (plan: typeof PLANS[number]) => {
    const Icon = plan.icon;
    const isCurrent = currentPlan === plan.id;
    const displayPrice = billing === 'yearly' ? (plan.priceYearly ?? plan.priceMonthly) : plan.priceMonthly;

    return (
      <div
        key={plan.id}
        className={cn(
          "relative flex flex-col rounded-xl border bg-card p-6 transition-all duration-300 hover:shadow-lg",
          plan.popular ? `border-2 ${plan.borderColor} shadow-md` : "border-border/60",
          isCurrent && "ring-2 ring-primary/20"
        )}
      >
        {plan.popular && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className={cn("text-[10px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full text-white", plan.bgColor)}>
              Most Popular
            </span>
          </div>
        )}

        <div className="mb-5">
          <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center mb-3", `${plan.bgColor}/10`)}>
            <Icon className={cn("h-4 w-4", plan.color)} />
          </div>
          <h3 className="text-lg font-semibold">{plan.name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>
        </div>

        <div className="flex items-baseline gap-1 mb-1.5">
          <span className="text-3xl font-bold tracking-tight">
            {plan.priceMonthly === 0 ? 'Free' : `$${displayPrice}`}
          </span>
          {plan.priceMonthly > 0 && (
            <span className="text-sm text-muted-foreground">/mo</span>
          )}
        </div>
        {plan.priceMonthly > 0 && billing === 'yearly' && plan.priceYearlyTotal && (
          <p className="text-[11px] text-muted-foreground mb-5">
            Billed ${plan.priceYearlyTotal}/yr
            <span className="ml-1.5 text-emerald-600 font-medium">
              Save ${(plan.priceMonthly - (plan.priceYearly ?? plan.priceMonthly)) * 12}/yr
            </span>
          </p>
        )}
        {!(plan.priceMonthly > 0 && billing === 'yearly' && plan.priceYearlyTotal) && (
          <div className="mb-5" />
        )}

        <ul className="space-y-2.5 flex-1 mb-6">
          {plan.features.map((feature, i) => (
            <li key={i} className="flex items-start gap-2">
              <Check className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", plan.color)} />
              <span className="text-xs text-muted-foreground leading-tight">{feature}</span>
            </li>
          ))}
        </ul>

        <Button
          onClick={() => handleSubscribe(plan.id)}
          disabled={loading || isCurrent}
          variant={plan.popular ? "default" : "outline"}
          className={cn(
            "w-full gap-1.5 text-xs font-medium",
            plan.popular && "shadow-md"
          )}
        >
          {loading && loadingPlan === plan.id ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : isCurrent ? (
            'Current Plan'
          ) : plan.id === 'free' ? (
            <>Start Free <ArrowRight className="h-3.5 w-3.5" /></>
          ) : (
            <>Get {plan.name} <ArrowRight className="h-3.5 w-3.5" /></>
          )}
        </Button>
      </div>
    );
  };

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-3 mb-8">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {PLANS.map(renderCard)}
      </div>

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
