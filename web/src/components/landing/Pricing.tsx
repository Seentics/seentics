'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/stores/useAuthStore';
import { motion } from 'framer-motion';
import { isEnterprise } from '@/lib/features';
import { PlanBuilder, PlanBuilderSelection } from '@/components/subscription/PlanBuilder';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useState } from 'react';

export default function Pricing() {
  if (!isEnterprise) return null;

  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async (selection: PlanBuilderSelection) => {
    if (!isAuthenticated) {
      window.location.href = '/signup';
      return;
    }

    try {
      setLoading(true);
      if (selection.totalPrice === 0) {
        window.location.href = '/websites';
        return;
      }

      const response = await api.post('/user/billing/checkout', {
        plan: 'custom',
        custom_limits: {
          max_monthly_events: selection.events,
          max_automations: selection.automations,
          max_funnels: selection.funnels,
          max_heatmaps: selection.heatmaps,
          max_replays: selection.recordings,
          max_websites: selection.websites,
          price_monthly: selection.totalPrice,
        },
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

  return (
    <section id="pricing" className="py-24 md:py-32 bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-4"
          >
            Pay only for what you use
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="text-muted-foreground text-lg"
          >
            Start free. Pick a preset or drag the sliders to build your perfect plan.
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <PlanBuilder onSubscribe={handleSubscribe} loading={loading} />
        </motion.div>
      </div>
    </section>
  );
}
