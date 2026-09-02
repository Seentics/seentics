'use client';

import { useAuth } from '@/stores/useAuthStore';
import { isEnterprise } from '@/lib/features';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useState } from 'react';
import { Check, Zap, Loader2, Shield, RefreshCw, ArrowRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { openCheckout } from '@/lib/checkout';

const FEATURES = [
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
];

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
        plan: 'lifetime',
        billing: 'monthly',
      });
      if (response.data.success && response.data.data.checkoutUrl) {
        openCheckout(response.data.data.checkoutUrl);
      } else {
        toast.error('Checkout not available. Please try again or contact support.');
      }
    } catch {
      toast.error('Failed to initialize checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="lifetime-deal" className="landing-section relative overflow-hidden bg-background">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[720px] max-w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/10 blur-[120px]" />

      <div className="container relative mx-auto px-6">
        {/* Header */}
        <div className="mx-auto mb-14 max-w-4xl text-center">
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span className="landing-eyebrow text-amber-600 dark:text-amber-400">Limited Time</span>
          </div>
          <h2 className="landing-h2 mb-4">
            Pay once. <span className="landing-accent">Use forever.</span>
          </h2>
          <p className="landing-lead">
            A one-time payment for lifetime access — no subscriptions, no recurring charges, ever.
          </p>
        </div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
          className="group relative mx-auto max-w-4xl overflow-hidden rounded-2xl border border-blue-500/30 bg-card shadow-2xl shadow-blue-500/15 transition-shadow duration-300 hover:shadow-blue-500/25 dark:border-blue-500/25 dark:shadow-blue-500/10"
        >
          {/* Top accent line */}
          <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-400" />

          <div className="grid md:grid-cols-[1.15fr_1fr]">
            {/* Left — value */}
            <div className="p-8 md:p-10">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-600/15">
                  <Zap className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="mb-0.5 text-xs font-bold uppercase tracking-widest text-blue-500">Lifetime Access</p>
                  <h3 className="landing-h3">Everything, forever.</h3>
                </div>
              </div>

              <ul className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                {FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-2.5">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600/15">
                      <Check className="h-3 w-3 text-blue-500" strokeWidth={3} />
                    </div>
                    <span className="text-sm text-foreground/80">{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right — price + CTA */}
            <div className="flex flex-col justify-center border-t border-border bg-gradient-to-b from-blue-500/[0.06] to-transparent p-8 dark:border-border/50 md:border-l md:border-t-0 md:p-10">
              {/* Price */}
              <div className="mb-6">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-sm text-muted-foreground line-through">$588/yr value</span>
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    Save 66%
                  </span>
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-extrabold leading-none tracking-tight text-foreground md:text-5xl">$199</span>
                  <span className="mb-2 text-base text-muted-foreground">one-time</span>
                </div>
              </div>

              {/* CTA */}
              <button
                onClick={handleSubscribe}
                disabled={loading}
                className={cn(
                  'group/btn relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-lg px-8 py-4 text-base font-semibold transition-all duration-200',
                  'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30',
                  'hover:scale-[1.02] hover:shadow-xl hover:shadow-blue-600/40 active:scale-[0.99]',
                  'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100',
                )}
              >
                {/* Shimmer sweep */}
                <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover/btn:translate-x-full" />
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" /> Processing…
                  </>
                ) : (
                  <>
                    Get Lifetime Access
                    <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                  </>
                )}
              </button>

              {/* Guarantees */}
              <div className="mt-6 space-y-2.5">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Shield className="h-4 w-4 shrink-0 text-blue-500" />
                  <span className="text-sm">30-day money-back guarantee</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <RefreshCw className="h-4 w-4 shrink-0 text-blue-500" />
                  <span className="text-sm">No recurring charges, ever</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
