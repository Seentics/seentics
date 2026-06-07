'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/stores/useAuthStore';
import { Button } from '@/components/ui/button';
import { openCheckout } from '@/lib/checkout';
import api from '@/lib/api';
import { toast } from 'sonner';
import {
  ArrowRight, Check, Loader2, Lock, Shield, RefreshCcw,
  Zap, Rocket, TrendingUp, Crown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Logo } from '@/components/ui/logo';

type PlanId = 'basic' | 'growth' | 'pro' | 'lifetime' | 'lifetime_pro';

const PLANS: Record<PlanId, {
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  priceMonthly: number;
  priceYearly?: number;
  priceYearlyTotal?: number;
  oneTime?: boolean;
  popular?: boolean;
  features: string[];
}> = {
  basic: {
    name: 'Starter',
    description: 'For indie makers and small projects',
    icon: Rocket,
    color: 'text-teal-500',
    bgColor: 'bg-teal-500',
    priceMonthly: 12,
    priceYearly: 10,
    priceYearlyTotal: 120,
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
  growth: {
    name: 'Growth',
    description: 'For growing products and teams',
    icon: TrendingUp,
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-500',
    priceMonthly: 25,
    priceYearly: 20,
    priceYearlyTotal: 240,
    popular: true,
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
  pro: {
    name: 'Pro',
    description: 'For scaling teams and high-traffic apps',
    icon: Crown,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500',
    priceMonthly: 65,
    priceYearly: 52,
    priceYearlyTotal: 624,
    features: [
      'Unlimited Websites',
      '2,000,000 Events / month',
      '50,000 Session Recordings',
      '5,000 AI Analyses / month',
      'Unlimited Heatmaps',
      'Unlimited Funnels & Automations',
      '5 Year Data Retention',
      'API, SDK & UI Blocks',
      '10 Team Members',
      'Priority Support',
    ],
  },
  lifetime: {
    name: 'Lifetime',
    description: 'Everything you need to get started.',
    icon: Zap,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500',
    priceMonthly: 199,
    oneTime: true,
    features: [
      'Unlimited Websites',
      '300,000 Events / month',
      '3,000 Session Recordings',
      '1,000 AI Analyses / month',
      'Unlimited Heatmaps',
      'Unlimited Funnels & Automations',
      '3 Year Data Retention',
      'API, SDK & UI Blocks',
      '9 Team Members',
      'Email Support',
    ],
  },
  lifetime_pro: {
    name: 'Lifetime Pro',
    description: 'More power for fast-growing products.',
    icon: Crown,
    color: 'text-violet-500',
    bgColor: 'bg-violet-500',
    priceMonthly: 399,
    oneTime: true,
    popular: true,
    features: [
      'Unlimited Websites',
      '1,000,000 Events / month',
      '10,000 Session Recordings',
      '3,000 AI Analyses / month',
      'Unlimited Heatmaps',
      'Unlimited Funnels & Automations',
      '5 Year Data Retention',
      'API, SDK & UI Blocks',
      'Unlimited Team Members',
      'Priority Support',
    ],
  },
};

function CheckoutContent() {
  const params = useSearchParams();
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const planId = (params.get('plan') ?? 'growth') as PlanId;
  const [loading, setLoading] = useState(false);

  const plan = PLANS[planId];

  if (!plan) {
    router.replace('/pricing');
    return null;
  }

  const Icon = plan.icon;
  const isOneTime = plan.oneTime;
  const price = plan.priceMonthly;
  const billedAmount = null;
  const savings = null;

  const handleProceed = async () => {
    if (!isAuthenticated) {
      router.push(`/signup?redirect=/checkout?plan=${planId}`);
      return;
    }
    try {
      setLoading(true);
      const res = await api.post('/user/billing/checkout', { plan: planId, billing: 'monthly' });
      if (res.data.success && res.data.data.checkoutUrl) {
        openCheckout(res.data.data.checkoutUrl);
      }
    } catch {
      toast.error('Failed to initialize checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Minimal header */}
      <header className="border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="container mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/">
            <Logo size="sm" showText />
          </Link>
          <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back to pricing
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-6 py-12 max-w-5xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

          {/* LEFT — Plan summary */}
          <div className="rounded-xl border border-border/60 bg-card p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', `${plan.bgColor}/10`)}>
                <Icon className={cn('h-5 w-5', plan.color)} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">{plan.name}</h2>
                  {plan.popular && (
                    <span className={cn('text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full text-white', plan.bgColor)}>
                      Popular
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{plan.description}</p>
              </div>
            </div>

            {/* Price */}
            <div className="border-t border-border/60 pt-6 mb-6">
              <div className="flex items-baseline gap-1.5 mb-1">
                <span className="text-4xl font-bold tracking-tight">${price}</span>
                {isOneTime ? (
                  <span className="text-sm text-muted-foreground">one-time</span>
                ) : (
                  <span className="text-sm text-muted-foreground">/mo</span>
                )}
              </div>
              {billedAmount && (
                <p className="text-xs text-muted-foreground">
                  Billed ${billedAmount}/year
                  {savings && (
                    <span className="ml-2 text-emerald-600 font-medium">Save ${savings}/yr</span>
                  )}
                </p>
              )}
              {isOneTime && (
                <p className="text-xs text-muted-foreground">Forever access. No recurring charges.</p>
              )}
            </div>

            {/* Features */}
            <ul className="space-y-3">
              {plan.features.map((f, i) => (
                <li key={i} className="flex items-center gap-2.5">
                  <Check className={cn('h-4 w-4 shrink-0', plan.color)} />
                  <span className="text-sm text-muted-foreground">{f}</span>
                </li>
              ))}
            </ul>

            {/* Trust badges */}
            <div className="border-t border-border/60 mt-6 pt-5 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <RefreshCcw className="h-3.5 w-3.5 shrink-0" />
                30-day money back guarantee
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Shield className="h-3.5 w-3.5 shrink-0" />
                Secure payment via Lemon Squeezy
              </div>
              {!isOneTime && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Check className="h-3.5 w-3.5 shrink-0" />
                  Cancel anytime, no questions asked
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — Order & CTA */}
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight mb-1">Complete your order</h1>
              <p className="text-sm text-muted-foreground">
                You&apos;re one step away from getting started with {plan.name}.
              </p>
            </div>

            {/* Order summary */}
            <div className="rounded-xl border border-border/60 bg-card p-5">
              <p className="text-sm font-medium mb-4">Order summary</p>
              <div className="flex justify-between items-center text-sm mb-2">
                <span className="text-muted-foreground">
                  {plan.name} {!isOneTime && '(monthly)'}
                </span>
                <span className="font-medium">
                  ${price}{isOneTime ? '' : '/mo'}
                </span>
              </div>
              {billedAmount && (
                <div className="flex justify-between items-center text-sm mb-2">
                  <span className="text-muted-foreground">Billed today</span>
                  <span className="font-medium">${billedAmount}</span>
                </div>
              )}
              <div className="border-t border-border/60 mt-3 pt-3 flex justify-between items-center">
                <span className="text-sm font-semibold">Total due today</span>
                <span className="text-lg font-bold">
                  ${isOneTime ? price : billedAmount ?? price}
                </span>
              </div>
            </div>

            {/* CTA */}
            <Button
              size="lg"
              className="w-full h-12 text-sm font-semibold gap-2 shadow-md"
              onClick={handleProceed}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  {isAuthenticated ? 'Proceed to Payment' : 'Sign up & Pay'}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
              <Lock className="h-3 w-3" />
              Secured by Lemon Squeezy. Your payment info is never stored on our servers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense>
      <CheckoutContent />
    </Suspense>
  );
}
