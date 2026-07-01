'use client';

import { useAuth } from '@/stores/useAuthStore';
import { isEnterprise } from '@/lib/features';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useState } from 'react';
import { Check, Zap, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const PLAN = {
  id: 'lifetime' as const,
  name: 'Lifetime',
  price: 199,
  description: 'Everything you need to get started.',
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
};

export default function LifetimeDeal() {
  if (!isEnterprise) return null;

  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    if (!isAuthenticated) {
      window.location.href = '/signup';
      return;
    }
    try {
      setLoading(true);
      const response = await api.post('/user/billing/checkout', {
        plan: PLAN.id,
        billing: 'monthly',
      });
      if (response.data.success && response.data.data.checkoutUrl) {
        window.location.href = response.data.data.checkoutUrl;
      }
    } catch {
      toast.error('Failed to initialize checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const Icon = PLAN.icon;

  return (
    <section id="lifetime-deal" className="py-24 md:py-32 bg-background">
      <div className="container mx-auto px-6">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-block bg-blue-600/10 border border-blue-600/20 rounded-full px-3 py-1.5 mb-6">
            <span className="text-xs font-bold uppercase tracking-widest text-blue-600">Limited Time</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3 leading-tight">Lifetime Deal</h2>
          <p className="text-muted-foreground text-base">
            One-time payment, forever access. No subscriptions, no recurring charges.
          </p>
        </div>

        {/* Single plan card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className={cn(
            'relative rounded-2xl border bg-gradient-to-br to-transparent p-12 shadow-lg max-w-2xl mx-auto',
            PLAN.bgGradient,
            PLAN.borderColor,
          )}
        >
          {/* Plan name + icon */}
          <div className="flex items-center gap-3 mb-8">
            <div className="h-11 w-11 rounded-xl bg-blue-600/10 flex items-center justify-center">
              <Icon className={cn('h-6 w-6', PLAN.color)} />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-foreground">{PLAN.name}</h3>
              <p className="text-sm text-muted-foreground">{PLAN.description}</p>
            </div>
          </div>

          {/* Price */}
          <div className="mb-8">
            <p className="text-sm text-muted-foreground font-medium mb-2">One-time payment</p>
            <div className="flex items-baseline gap-1">
              <span className={cn('text-7xl font-bold tracking-tight', PLAN.color)}>${PLAN.price}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">Forever access. No recurring charges.</p>
          </div>

          {/* Features */}
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
            {PLAN.features.map((feature, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <Check className={cn('h-4 w-4 shrink-0 mt-0.5', PLAN.color)} />
                <span className="text-sm text-muted-foreground leading-relaxed">{feature}</span>
              </li>
            ))}
          </ul>

          <Button
            onClick={handleSubscribe}
            disabled={loading}
            size="lg"
            className={cn('w-full text-base font-semibold h-13 mb-8', PLAN.buttonClass)}
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : `Get ${PLAN.name}`}
          </Button>

          <div className="flex flex-wrap gap-x-8 gap-y-3 border-t border-border/50 pt-6">
            <div className="flex items-center gap-2">
              <Check className={cn('h-4 w-4 shrink-0', PLAN.color)} />
              <span className="text-sm text-muted-foreground">30-day money back guarantee</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className={cn('h-4 w-4 shrink-0', PLAN.color)} />
              <span className="text-sm text-muted-foreground">No recurring charges ever</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
