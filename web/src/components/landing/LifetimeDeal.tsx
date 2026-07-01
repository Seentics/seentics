'use client';

import { useAuth } from '@/stores/useAuthStore';
import { isEnterprise } from '@/lib/features';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useState } from 'react';
import { Check, Zap, Loader2, Shield, RefreshCw } from 'lucide-react';
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
    <section id="lifetime-deal" className="py-24 md:py-32 bg-background">
      <div className="container mx-auto px-6">

        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-block bg-blue-600/10 border border-blue-600/20 rounded-full px-4 py-1.5 mb-6">
            <span className="text-xs font-bold uppercase tracking-widest text-blue-500">Limited Time</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-4">
            Lifetime Deal
          </h2>
          <p className="text-muted-foreground text-lg">
            One-time payment, forever access. No subscriptions, no recurring charges.
          </p>
        </div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
          className="relative max-w-2xl mx-auto rounded-3xl border border-blue-500/25 bg-gradient-to-b from-blue-600/8 to-transparent overflow-hidden shadow-2xl shadow-blue-500/10"
        >
          {/* Top accent line */}
          <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-400" />

          <div className="p-10 md:p-14">

            {/* Badge + icon */}
            <div className="flex items-center gap-3 mb-8">
              <div className="h-12 w-12 rounded-2xl bg-blue-600/15 border border-blue-500/20 flex items-center justify-center">
                <Zap className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-blue-500 mb-0.5">Lifetime Access</p>
                <h3 className="text-xl font-bold text-foreground">Everything, forever.</h3>
              </div>
            </div>

            {/* Price */}
            <div className="mb-10">
              <div className="flex items-end gap-2 mb-2">
                <span className="text-7xl md:text-8xl font-extrabold tracking-tight text-foreground leading-none">$199</span>
                <span className="text-muted-foreground text-base mb-3">one-time</span>
              </div>
              <p className="text-sm text-muted-foreground">Pay once. Use forever. No surprises.</p>
            </div>

            {/* Features grid */}
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3.5 mb-10">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2.5">
                  <div className="h-5 w-5 rounded-full bg-blue-600/15 flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 text-blue-500" />
                  </div>
                  <span className="text-sm text-foreground/80">{f}</span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <button
              onClick={handleSubscribe}
              disabled={loading}
              className={cn(
                'w-full flex items-center justify-center gap-2.5 rounded-xl px-8 py-4 text-base font-semibold transition-all duration-200',
                'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 hover:shadow-blue-500/40',
                'disabled:opacity-60 disabled:cursor-not-allowed',
              )}
            >
              {loading
                ? <><Loader2 className="h-5 w-5 animate-spin" /> Processing…</>
                : 'Get Lifetime Access — $199'}
            </button>

            {/* Guarantees */}
            <div className="flex flex-wrap items-center justify-center gap-6 mt-6 pt-6 border-t border-border/40">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Shield className="h-4 w-4 text-blue-500 shrink-0" />
                <span className="text-sm">30-day money-back guarantee</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <RefreshCw className="h-4 w-4 text-blue-500 shrink-0" />
                <span className="text-sm">No recurring charges, ever</span>
              </div>
            </div>

          </div>
        </motion.div>

      </div>
    </section>
  );
}
