'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  ArrowRight, Loader2, Check, Zap, Crown, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PlanSelection {
  plan: 'starter' | 'growth' | 'pro' | 'enterprise';
  price: number;
}

interface PlanBuilderProps {
  onSubscribe?: (selection: PlanSelection) => void;
  loading?: boolean;
  currentPlan?: string;
}

const PLANS = [
  {
    id: 'starter' as const,
    name: 'Starter',
    price: 0,
    description: 'For side projects and personal sites',
    icon: Zap,
    color: 'text-blue-500',
    borderColor: 'border-blue-500',
    bgColor: 'bg-blue-500',
    features: [
      '1 Website',
      '10,000 Monthly Events',
      '3 Heatmap Pages',
      '100 Session Recordings',
      '1 Funnel',
      '1 Automation',
      '30 Day Data Retention',
      'Community Support',
    ],
  },
  {
    id: 'growth' as const,
    name: 'Growth',
    price: 29,
    description: 'For growing businesses',
    icon: Zap,
    popular: true,
    color: 'text-indigo-500',
    borderColor: 'border-indigo-500',
    bgColor: 'bg-indigo-500',
    features: [
      '3 Websites',
      '200,000 Monthly Events',
      'Unlimited Heatmaps',
      '10,000 Session Recordings',
      '10 Funnels',
      '10 Automations',
      '3 Month Recording Retention',
      '2 Year Analytics Retention',
      'Email Support',
    ],
  },
  {
    id: 'pro' as const,
    name: 'Pro',
    price: 79,
    description: 'For scaling teams',
    icon: Crown,
    color: 'text-purple-500',
    borderColor: 'border-purple-500',
    bgColor: 'bg-purple-500',
    features: [
      '15 Websites',
      '2,000,000 Monthly Events',
      'Unlimited Heatmaps',
      '50,000 Session Recordings',
      'Unlimited Funnels',
      'Unlimited Automations',
      '3 Month Recording Retention',
      '5 Year Analytics Retention',
      'Priority Support',
    ],
  },
  {
    id: 'enterprise' as const,
    name: 'Enterprise',
    price: 399,
    description: 'For agencies and large teams',
    icon: Sparkles,
    color: 'text-amber-500',
    borderColor: 'border-amber-500',
    bgColor: 'bg-amber-500',
    features: [
      '100 Websites',
      '15,000,000 Monthly Events',
      'Unlimited Heatmaps',
      '200,000 Session Recordings',
      'Unlimited Funnels',
      'Unlimited Automations',
      '3 Month Recording Retention',
      '7 Year Analytics Retention',
      'White Label Solution',
      'Client Management',
      'Dedicated Support',
    ],
  },
];

export function PlanBuilder({ onSubscribe, loading, currentPlan }: PlanBuilderProps) {
  const [loadingPlan, setLoadingPlan] = React.useState<string | null>(null);

  const handleSubscribe = (planId: 'starter' | 'growth' | 'pro' | 'enterprise') => {
    if (!onSubscribe) return;
    const plan = PLANS.find(p => p.id === planId);
    if (!plan) return;
    setLoadingPlan(planId);
    onSubscribe({ plan: planId, price: plan.price });
  };

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          const isCurrent = currentPlan === plan.id;

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

              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-3xl font-bold tracking-tight">
                  ${plan.price}
                </span>
                <span className="text-sm text-muted-foreground">/mo</span>
              </div>

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
                ) : plan.price === 0 ? (
                  <>Start Free <ArrowRight className="h-3.5 w-3.5" /></>
                ) : (
                  <>Get {plan.name} <ArrowRight className="h-3.5 w-3.5" /></>
                )}
              </Button>
            </div>
          );
        })}
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
