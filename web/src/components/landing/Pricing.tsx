'use client';

import { useAuth } from '@/stores/useAuthStore';
import { motion } from 'framer-motion';
import { isEnterprise } from '@/lib/features';
import { PlanBuilder, PlanSelection } from '@/components/subscription/PlanBuilder';
import api from '@/lib/api';
import { openCheckout } from '@/lib/checkout';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const CHECKOUT_INTENT_KEY = 'seentics_checkout_intent';
import { Users, Building2, ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Pricing() {
  if (!isEnterprise) return null;

  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'individual' | 'agency'>('individual');
  const [waitingForPayment, setWaitingForPayment] = useState(false);

  // Auto-trigger checkout if user just signed up with a plan intent
  useEffect(() => {
    if (!isAuthenticated) return;
    const raw = sessionStorage.getItem(CHECKOUT_INTENT_KEY);
    if (!raw) return;
    try {
      const intent = JSON.parse(raw) as PlanSelection;
      sessionStorage.removeItem(CHECKOUT_INTENT_KEY);
      handleSubscribe(intent);
    } catch {
      sessionStorage.removeItem(CHECKOUT_INTENT_KEY);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const handleSubscribe = async (selection: PlanSelection) => {
    if (!isAuthenticated) {
      sessionStorage.setItem(CHECKOUT_INTENT_KEY, JSON.stringify(selection));
      router.push('/signup');
      return;
    }
    try {
      setLoading(true);
      if (selection.price === 0) {
        router.push('/websites');
        return;
      }
      const response = await api.post('/user/billing/checkout', {
        plan: selection.plan,
        billing: selection.billing,
      });
      if (response.data.success && response.data.data.checkoutUrl) {
        setWaitingForPayment(true);
        openCheckout(
          response.data.data.checkoutUrl,
          () => {
            toast.success('Plan activated! Taking you to your dashboard…');
            router.push('/websites');
          },
          () => {
            setWaitingForPayment(false);
            toast.info('Payment received — your plan will activate shortly.');
            router.push('/websites');
          },
        );
      }
    } catch {
      toast.error('Failed to initialize checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (waitingForPayment) {
    return (
      <section id="pricing" className="landing-section bg-background flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-sm px-6">
          <div className="flex justify-center mb-4">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-7 w-7 text-primary animate-spin" />
            </div>
          </div>
          <h2 className="text-xl font-semibold mb-2">Complete your payment</h2>
          <p className="text-sm text-muted-foreground">Finish the checkout in the tab that just opened. Your plan will activate automatically once payment is confirmed.</p>
        </div>
      </section>
    );
  }

  return (
    <section id="pricing" className="landing-section border-y border-border bg-muted/50 dark:border-transparent dark:bg-background">
      <div className="landing-container">
        {/* Header */}
        <div className="text-center max-w-4xl mx-auto mb-10">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="landing-eyebrow"
          >
            Pricing
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="landing-h2 mb-4"
          >
            Simple, <span className="landing-accent">transparent pricing</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="landing-lead"
          >
            Unlimited websites on every plan. Pay only for events.
          </motion.p>
        </div>

        {/* Individual / Agency tab */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="flex justify-center mb-10"
        >
          <div className="flex items-center gap-1 p-1 bg-black/[0.04] border border-border rounded-lg dark:bg-muted/50 dark:border-border/60">
            <button
              onClick={() => setMode('individual')}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all',
                mode === 'individual'
                  ? 'bg-background text-foreground shadow-sm border border-border dark:border-border/60'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Users className="h-4 w-4" />
              Individual
            </button>
            <button
              onClick={() => setMode('agency')}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all',
                mode === 'agency'
                  ? 'bg-background text-foreground shadow-sm border border-border dark:border-border/60'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Building2 className="h-4 w-4" />
              Agency
            </button>
          </div>
        </motion.div>

        {mode === 'agency' && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-sm text-muted-foreground max-w-xl mx-auto mb-8"
          >
            Manage unlimited client workspaces, white-label the platform, and access all data via API.
            Events are pooled across all clients.
          </motion.p>
        )}

        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <PlanBuilder onSubscribe={handleSubscribe} loading={loading} mode={mode} />
        </motion.div>

        {/* Test / Sandbox checkout card — disabled in production
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mt-10 max-w-sm mx-auto"
        >
          <div className="relative flex flex-col rounded-lg border-2 border-dashed border-amber-400/60 bg-amber-50/30 dark:bg-amber-950/10 p-5">
            <div className="absolute -top-3 left-4">
              <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-400 text-amber-950">
                <FlaskConical className="h-3 w-3" />
                Sandbox / Test Only
              </span>
            </div>
            <div className="mb-3 pt-1">
              <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-400">Test Checkout</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Test the full payment &amp; subscription webhook flow with Lemon Squeezy test mode.</p>
            </div>
            <ul className="space-y-1.5 mb-4">
              {['Triggers real webhook flow', 'Sets subscription to Pro plan', 'Use LS test card: 4242 4242 4242 4242'].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="h-3 w-3 mt-0.5 shrink-0 text-amber-500" />
                  <span className="text-[11px] text-muted-foreground">{f}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleSubscribe({ plan: 'pro', price: 69, billing: 'monthly' })}
              disabled={loading}
              className="flex items-center justify-center gap-1.5 w-full rounded-lg border border-amber-400 bg-amber-400/10 hover:bg-amber-400/20 text-amber-700 dark:text-amber-400 text-xs font-semibold py-2 transition-colors disabled:opacity-50"
            >
              Open Test Checkout <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
        */}
      </div>
    </section>
  );
}
