'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { PlanBuilder, PlanSelection } from '@/components/subscription/PlanBuilder';
import { useState } from 'react';
import { Users, Building2, ArrowRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    <section id="pricing" className="landing-section bg-background">
      <div className="landing-container">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-10">
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
