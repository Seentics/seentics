'use client';

import Link from 'next/link';
import { useAuth } from '@/stores/useAuthStore';
import { motion } from 'framer-motion';
import { isEnterprise } from '@/lib/features';
import { PlanBuilder, PlanSelection } from '@/components/subscription/PlanBuilder';
import api from '@/lib/api';
import { openCheckout } from '@/lib/checkout';
import { toast } from 'sonner';
import { useState } from 'react';
import { Users, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Pricing() {
  if (!isEnterprise) return null;

  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'individual' | 'agency'>('individual');

  const handleSubscribe = async (selection: PlanSelection) => {
    if (!isAuthenticated) {
      window.location.href = '/signup';
      return;
    }

    try {
      setLoading(true);
      if (selection.price === 0) {
        window.location.href = '/websites';
        return;
      }

      const response = await api.post('/user/billing/checkout', {
        plan: selection.plan,
        billing: selection.billing,
      });

      if (response.data.success && response.data.data.checkoutUrl) {
        openCheckout(response.data.data.checkoutUrl);
      }
    } catch {
      toast.error('Failed to initialize checkout. Please try again.');
    } finally {
      setLoading(false);
    }
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
          <div className="flex items-center gap-1 p-1 bg-muted/50 border border-border/60 rounded-xl">
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
      </div>
    </section>
  );
}
