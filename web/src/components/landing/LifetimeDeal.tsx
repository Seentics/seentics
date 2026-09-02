'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Loader2, RefreshCw, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { isEnterprise } from '@/lib/features';
import api from '@/lib/api';
import { openCheckout } from '@/lib/checkout';
import { useAuth } from '@/stores/useAuthStore';

/**
 * The lifetime offer.
 *
 * This section used to carry eight separate decorative devices — a 420x720
 * `blur-[120px]` glow, a gradient accent bar, a blue card border, a blue card
 * shadow that changed on hover, a blue gradient panel, a gradient CTA with its own
 * coloured shadow, a hover scale and a shimmer sweep animation — all of them blue,
 * on a page whose whole colour budget is one accent per section and primary on
 * things you can click.
 *
 * None of it is here now. The offer is the strongest one on the page and it does not
 * need help: the price is the anchor because it is the biggest thing in the card, not
 * because it glows.
 */

const FEATURES = [
  'Unlimited websites',
  '300,000 events / month',
  '3,000 session recordings',
  '1,000 AI analyses / month',
  'Unlimited heatmaps',
  'Unlimited funnels & automations',
  '3 year data retention',
  'API, SDK & UI blocks',
  '9 team members',
  'Email support',
];

const GUARANTEES = [
  { icon: Shield, text: '30-day money-back guarantee' },
  { icon: RefreshCw, text: 'No recurring charges, ever' },
];

export default function LifetimeDeal() {
  // Every hook runs before the enterprise guard below. It used to sit above
  // `useAuth` and `useState`, which is only legal because `isEnterprise` is a module
  // constant that never changes between renders.
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

  if (!isEnterprise) return null;

  return (
    <section id="lifetime-deal" className="landing-section landing-band">
      <div className="landing-container relative">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          {/* Amber stays: it means something here — the offer really is time-limited. */}
          <p className="landing-eyebrow text-amber-600 dark:text-amber-400">Limited time</p>
          <h2 className="landing-h2 mb-4">
            Pay once. <span className="landing-accent">Use forever.</span>
          </h2>
          <p className="landing-lead">
            A one-time payment for lifetime access — no subscriptions, no recurring charges, ever.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.45 }}
          className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
        >
          <div className="grid md:grid-cols-[1.1fr_1fr]">
            {/* What you get */}
            <div className="p-8 md:p-10">
              <p className="landing-eyebrow">Lifetime access</p>
              <h3 className="landing-h3 mb-6">Everything, forever.</h3>

              <ul className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                {FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-foreground/85">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* What it costs. Separated by a rule rather than a tinted panel — the
                section's own band already does the tinting. */}
            <div className="flex flex-col justify-center border-t border-border p-8 md:border-l md:border-t-0 md:p-10">
              <div className="mb-7">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-foreground line-through">$588/yr value</span>
                  <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                    Save 66%
                  </span>
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-5xl font-extrabold leading-none tracking-tighter tabular-nums text-foreground">
                    $199
                  </span>
                  <span className="mb-1.5 text-base text-muted-foreground">one-time</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSubscribe}
                disabled={loading}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing…
                  </>
                ) : (
                  <>
                    Get lifetime access
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              <ul className="mt-6 space-y-2.5">
                {GUARANTEES.map((g) => (
                  <li key={g.text} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <g.icon className="h-4 w-4 shrink-0 text-foreground/40" />
                    {g.text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
