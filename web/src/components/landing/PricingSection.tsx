'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { PlanBuilder, PlanSelection } from '@/components/subscription/PlanBuilder';
import { useState } from 'react';
import { Users, Building2, FlaskConical, ArrowRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const TEST_CHECKOUT_URL = 'https://seentics.lemonsqueezy.com/checkout/buy/2ccc5601-1010-488b-8cf3-7784c0eb31aa?checkout%5Bcustom%5D%5Bplan%5D=pro';
export default function PricingSection() {
  const router = useRouter();
  const [mode, setMode] = useState<'individual' | 'agency'>('individual');
  const [loading, setLoading] = useState(false);

  const handleSubscribe = (selection: PlanSelection) => {
    setLoading(true);
    // In OSS/demo mode — just send to signup
    router.push('/signup');
  };

  return (
    <section id="pricing" className="py-24 md:py-32 bg-background">
      <div className="container mx-auto px-6">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-xs font-semibold uppercase tracking-widest text-primary mb-3"
          >
            Pricing
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-4"
          >
            Simple, transparent pricing
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-muted-foreground text-lg"
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
          <div className="flex items-center gap-1 p-1 bg-muted/50 border border-border/60 rounded-lg">
            <button
              onClick={() => setMode('individual')}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all',
                mode === 'individual'
                  ? 'bg-background text-foreground shadow-sm border border-border/60'
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
                  ? 'bg-background text-foreground shadow-sm border border-border/60'
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

        {/* Test / Sandbox plan */}
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
              <p className="text-xs text-muted-foreground mt-0.5">Use this to test the full payment & subscription flow with Lemon Squeezy test mode.</p>
            </div>
            <ul className="space-y-1.5 mb-4">
              {['Triggers real webhook flow', 'Sets subscription to Pro plan', 'Use LS test card: 4242 4242 4242 4242'].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="h-3 w-3 mt-0.5 shrink-0 text-amber-500" />
                  <span className="text-[11px] text-muted-foreground">{f}</span>
                </li>
              ))}
            </ul>
            <a
              href={TEST_CHECKOUT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 w-full rounded-lg border border-amber-400 bg-amber-400/10 hover:bg-amber-400/20 text-amber-700 dark:text-amber-400 text-xs font-semibold py-2 transition-colors"
            >
              Open Test Checkout <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </motion.div>

        {/* Self-hosted note */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-12 max-w-2xl mx-auto p-6 rounded-lg border border-border/50 bg-muted/30 text-center"
        >
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Prefer self-hosted?</strong>{' '}
            Deploy on your own infrastructure for free. The entire platform is open source.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
