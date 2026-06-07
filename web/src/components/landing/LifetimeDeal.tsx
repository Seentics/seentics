'use client';

import { useAuth } from '@/stores/useAuthStore';
import { isEnterprise } from '@/lib/features';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useState } from 'react';
import { Check, Zap, Crown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const PLANS = [
  {
    id: 'lifetime' as const,
    name: 'Lifetime',
    price: 199,
    description: 'Everything you need to get started.',
    badge: null,
    icon: Zap,
    color: 'text-blue-600',
    borderColor: 'border-blue-500/30',
    bgGradient: 'from-blue-600/5',
    buttonClass: 'bg-blue-600 hover:bg-blue-700 text-white',
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
  {
    id: 'lifetime_pro' as const,
    name: 'Lifetime Pro',
    price: 399,
    description: 'More power for fast-growing products.',
    badge: 'Best Value',
    icon: Crown,
    color: 'text-violet-600',
    borderColor: 'border-violet-500/60',
    bgGradient: 'from-violet-600/5',
    buttonClass: 'bg-violet-600 hover:bg-violet-700 text-white',
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
];

export default function LifetimeDeal() {
  if (!isEnterprise) return null;

  const { isAuthenticated } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleSubscribe = async (planId: 'lifetime' | 'lifetime_pro') => {
    if (!isAuthenticated) {
      window.location.href = '/signup';
      return;
    }
    try {
      setLoadingPlan(planId);
      const response = await api.post('/user/billing/checkout', {
        plan: planId,
        billing: 'monthly',
      });
      if (response.data.success && response.data.data.checkoutUrl) {
        window.location.href = response.data.data.checkoutUrl;
      }
    } catch {
      toast.error('Failed to initialize checkout. Please try again.');
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <section id="lifetime-deal" className="py-24 md:py-32 bg-background">
      <div className="container mx-auto px-6">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-block bg-blue-600/10 border border-blue-600/20 rounded-full px-3 py-1.5 mb-6">
            <span className="text-xs font-bold uppercase tracking-widest text-blue-600">Limited Time</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3 leading-tight">Lifetime Deal</h2>
          <p className="text-muted-foreground text-base">
            One-time payment, forever access. No subscriptions, no recurring charges.
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {PLANS.map((plan, index) => {
            const Icon = plan.icon;
            const isLoading = loadingPlan === plan.id;

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
                className={cn(
                  'relative rounded-2xl border bg-gradient-to-br to-transparent p-8 transition-all duration-300',
                  plan.bgGradient,
                  plan.borderColor,
                  plan.badge ? 'shadow-lg' : 'shadow-sm',
                )}
              >
                {plan.badge && (
                  <div className="absolute -top-4 right-6">
                    <span className="inline-block text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full text-white bg-violet-600">
                      {plan.badge}
                    </span>
                  </div>
                )}

                {/* Plan name + icon */}
                <div className="flex items-center gap-2.5 mb-5 pt-1">
                  <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', `${plan.color}/10 bg-current/10`)}>
                    <Icon className={cn('h-4 w-4', plan.color)} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">{plan.name}</h3>
                    <p className="text-xs text-muted-foreground">{plan.description}</p>
                  </div>
                </div>

                {/* Price */}
                <div className="mb-6">
                  <p className="text-xs text-muted-foreground font-medium mb-1.5">One-time payment</p>
                  <div className="flex items-baseline gap-1">
                    <span className={cn('text-5xl font-bold tracking-tight', plan.color)}>${plan.price}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Forever access. No recurring charges.</p>
                </div>

                {/* Features */}
                <ul className="space-y-2.5 mb-7">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <Check className={cn('h-3.5 w-3.5 shrink-0 mt-0.5', plan.color)} />
                      <span className="text-xs text-muted-foreground leading-relaxed">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={!!loadingPlan}
                  size="lg"
                  className={cn('w-full text-sm font-semibold mb-5', plan.buttonClass)}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : `Get ${plan.name}`}
                </Button>

                <div className="space-y-2.5 border-t border-border/50 pt-5">
                  <div className="flex items-center gap-2">
                    <Check className={cn('h-3.5 w-3.5 shrink-0', plan.color)} />
                    <span className="text-xs text-muted-foreground">30-day money back guarantee</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className={cn('h-3.5 w-3.5 shrink-0', plan.color)} />
                    <span className="text-xs text-muted-foreground">No recurring charges ever</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
