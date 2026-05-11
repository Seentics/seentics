'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, Loader2, Check, Zap, Rocket, TrendingUp, Crown, Building2, Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PlanSelection {
  plan: 'starter' | 'basic' | 'growth' | 'pro' | 'lifetime' | 'lifetime_pro' | 'agency' | 'agency_pro';
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

const INDIVIDUAL_PLANS = [
  {
    id: 'starter' as const,
    name: 'Free',
    priceMonthly: 0,
    priceYearly: 0,
    description: 'For side projects and personal sites',
    icon: Zap,
    color: 'text-slate-500',
    borderColor: 'border-slate-300',
    bgColor: 'bg-slate-500',
    features: [
      'Unlimited Websites',
      '10,000 Events / month',
      '5 Session Recordings',
      '30 AI Analyses / month',
      '3 Heatmap Pages',
      '1 Funnel & 1 Automation',
      '30 Day Data Retention',
      'API, SDK & UI Blocks',
      '1 Team Member',
      'Community Support',
    ],
  },
  {
    id: 'basic' as const,
    name: 'Starter',
    priceMonthly: 12,
    priceYearly: 10,
    priceYearlyTotal: 120,
    description: 'For indie makers and small projects',
    icon: Rocket,
    color: 'text-teal-500',
    borderColor: 'border-teal-500',
    bgColor: 'bg-teal-500',
    features: [
      'Unlimited Websites',
      '100,000 Events / month',
      '1,000 Session Recordings',
      '500 AI Analyses / month',
      'Unlimited Heatmaps',
      'Unlimited Funnels & Automations',
      '1 Year Data Retention',
      'API, SDK & UI Blocks',
      '3 Team Members',
      'Email Support',
    ],
  },
  {
    id: 'growth' as const,
    name: 'Growth',
    priceMonthly: 25,
    priceYearly: 20,
    priceYearlyTotal: 240,
    description: 'For growing products and teams',
    icon: TrendingUp,
    popular: true,
    color: 'text-indigo-500',
    borderColor: 'border-indigo-500',
    bgColor: 'bg-indigo-500',
    features: [
      'Unlimited Websites',
      '500,000 Events / month',
      '10,000 Session Recordings',
      '1,500 AI Analyses / month',
      'Unlimited Heatmaps',
      'Unlimited Funnels & Automations',
      '2 Year Data Retention',
      'API, SDK & UI Blocks',
      '5 Team Members',
      'Email Support',
    ],
  },
  {
    id: 'pro' as const,
    name: 'Pro',
    priceMonthly: 65,
    priceYearly: 52,
    priceYearlyTotal: 624,
    description: 'For scaling teams and high-traffic apps',
    icon: Crown,
    color: 'text-amber-500',
    borderColor: 'border-amber-500',
    bgColor: 'bg-amber-500',
    features: [
      'Unlimited Websites',
      '2,000,000 Events / month',
      '50,000 Session Recordings',
      '5,000 AI Analyses / month',
      'Unlimited Heatmaps',
      'Unlimited Funnels',
      'Unlimited Automations',
      '5 Year Data Retention',
      'API, SDK & UI Blocks',
      '10 Team Members',
      'Priority Support',
    ],
  },
];

const AGENCY_PLANS = [
  {
    id: 'agency' as const,
    name: 'Agency',
    priceMonthly: 129,
    priceYearly: 103,
    priceYearlyTotal: 1236,
    description: 'For agencies managing multiple clients',
    icon: Building2,
    color: 'text-violet-500',
    borderColor: 'border-violet-500',
    bgColor: 'bg-violet-500',
    features: [
      'Unlimited Client Workspaces',
      '5,000,000 Events / month',
      '100,000 Session Recordings',
      'Unlimited AI Analyses',
      'Unlimited Heatmaps',
      'White Label Branding',
      'Custom Domain',
      '3 Year Data Retention',
      'API, SDK & UI Blocks',
      'Priority Support',
    ],
  },
  {
    id: 'agency_pro' as const,
    name: 'Agency Pro',
    priceMonthly: 329,
    priceYearly: 263,
    priceYearlyTotal: 3156,
    description: 'For large agencies with dedicated support',
    icon: Shield,
    popular: true,
    color: 'text-rose-500',
    borderColor: 'border-rose-500',
    bgColor: 'bg-rose-500',
    features: [
      'Unlimited Client Workspaces',
      '20,000,000 Events / month',
      '500,000 Session Recordings',
      'Unlimited AI Analyses',
      'Unlimited Heatmaps',
      'White Label Branding',
      'Custom Domain',
      'Client Self-Service Portal',
      '7 Year Data Retention',
      'API, SDK & UI Blocks',
      'Dedicated Support & SLA',
    ],
  },
];

export function PlanBuilder({ onSubscribe, loading, currentPlan, mode = 'individual' }: PlanBuilderProps) {
  const [loadingPlan, setLoadingPlan] = React.useState<string | null>(null);
  const [billing, setBilling] = React.useState<'monthly' | 'yearly'>('monthly');

  const plans = mode === 'agency' ? AGENCY_PLANS : INDIVIDUAL_PLANS;

  const handleSubscribe = (planId: PlanSelection['plan']) => {
    if (!onSubscribe) return;
    const plan = [...INDIVIDUAL_PLANS, ...AGENCY_PLANS].find(p => p.id === planId);
    if (!plan) return;
    setLoadingPlan(planId);
    const price = billing === 'yearly' ? (plan.priceYearly ?? plan.priceMonthly) : plan.priceMonthly;
    onSubscribe({ plan: planId, price, billing });
  };

  const renderCard = (plan: typeof INDIVIDUAL_PLANS[number] | typeof AGENCY_PLANS[number]) => {
    const Icon = plan.icon;
    const isCurrent = currentPlan === plan.id || (plan.id === 'starter' && (currentPlan === 'free' || !currentPlan));
    const displayPrice = billing === 'yearly' ? (plan.priceYearly ?? plan.priceMonthly) : plan.priceMonthly;
    const isFree = plan.priceMonthly === 0;

    return (
      <div
        key={plan.id}
        className={cn(
          'relative flex flex-col rounded-xl border bg-card p-6 transition-all duration-300 hover:shadow-lg',
          'popular' in plan && plan.popular ? `border-2 ${plan.borderColor} shadow-md` : 'border-border/60',
          isCurrent && 'ring-2 ring-primary/20',
        )}
      >
        {'popular' in plan && plan.popular && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className={cn('text-[10px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full text-white', plan.bgColor)}>
              Most Popular
            </span>
          </div>
        )}

        <div className="mb-5">
          <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center mb-3', `${plan.bgColor}/10`)}>
            <Icon className={cn('h-4 w-4', plan.color)} />
          </div>
          <h3 className="text-lg font-semibold">{plan.name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>
        </div>

        <div className="flex items-baseline gap-1 mb-1.5">
          <span className="text-3xl font-bold tracking-tight">
            {isFree ? 'Free' : `$${displayPrice}`}
          </span>
          {!isFree && <span className="text-sm text-muted-foreground">/mo</span>}
        </div>

        {!isFree && billing === 'yearly' && 'priceYearlyTotal' in plan && plan.priceYearlyTotal ? (
          <p className="text-[11px] text-muted-foreground mb-5">
            Billed ${plan.priceYearlyTotal}/yr
            <span className="ml-1.5 text-emerald-600 font-medium">
              Save ${(plan.priceMonthly - (plan.priceYearly ?? plan.priceMonthly)) * 12}/yr
            </span>
          </p>
        ) : (
          <div className="mb-5" />
        )}

        <ul className="space-y-2.5 flex-1 mb-6">
          {plan.features.map((feature, i) => (
            <li key={i} className="flex items-start gap-2">
              <Check className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', plan.color)} />
              <span className="text-xs text-muted-foreground leading-tight">{feature}</span>
            </li>
          ))}
        </ul>

        <Button
          onClick={() => handleSubscribe(plan.id as PlanSelection['plan'])}
          disabled={loading || isCurrent}
          variant={'popular' in plan && plan.popular ? 'default' : 'outline'}
          className={cn('w-full gap-1.5 text-xs font-medium', 'popular' in plan && plan.popular && 'shadow-md')}
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
    <div className="w-full max-w-6xl mx-auto">
      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-3 mb-8">
        <button
          onClick={() => setBilling('monthly')}
          className={cn(
            'text-sm font-medium transition-colors',
            billing === 'monthly' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Monthly
        </button>
        <button
          onClick={() => setBilling(billing === 'monthly' ? 'yearly' : 'monthly')}
          className={cn(
            'relative w-10 h-5 rounded-full transition-colors focus:outline-none',
            billing === 'yearly' ? 'bg-primary' : 'bg-muted',
          )}
          aria-label="Toggle billing period"
        >
          <span className={cn(
            'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
            billing === 'yearly' && 'translate-x-5',
          )} />
        </button>
        <button
          onClick={() => setBilling('yearly')}
          className={cn(
            'text-sm font-medium transition-colors flex items-center gap-1.5',
            billing === 'yearly' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Yearly
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            Save ~20%
          </span>
        </button>
      </div>

      <div className={cn(
        'grid gap-5',
        mode === 'agency' ? 'grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
      )}>
        {plans.map(renderCard)}
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
