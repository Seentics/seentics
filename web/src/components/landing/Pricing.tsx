'use client';

import { useAuth } from '@/stores/useAuthStore';
import { isEnterprise } from '@/lib/features';
import { PlanBuilder, PlanSelection } from '@/components/subscription/PlanBuilder';
import { rememberCheckoutIntent, startCheckout } from '@/lib/checkout';
import { toast } from 'sonner';
import { useState } from 'react';
import { useRouter } from 'next/navigation';


export default function Pricing() {
  if (!isEnterprise) return null;

  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async (selection: PlanSelection) => {
    if (selection.price === 0) {
      router.push(isAuthenticated ? '/websites' : '/signup');
      return;
    }
    if (!isAuthenticated) {
      // Sign up first; the dashboard then takes them straight to this plan's checkout.
      rememberCheckoutIntent(selection.plan, selection.interval, selection.discount);
      router.push('/signup');
      return;
    }
    try {
      setLoading(true);
      await startCheckout(selection.plan, selection.interval, selection.discount);
    } catch {
      toast.error('Failed to initialize checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="pricing" className="landing-section scroll-mt-20">
      <div className="landing-container">
        <div className="mb-12 grid gap-6 lg:grid-cols-2 lg:items-end lg:gap-16">
          <h2 className="lx-display text-[1.75rem] sm:text-4xl">
            Every plan has everything.
            <br />
            <span className="lx-dim">Only the amounts differ.</span>
          </h2>
          <p className="lx-dim max-w-md text-base leading-relaxed">
            Analytics, replay, heatmaps, funnels and popups on every plan. Free, Starter and Pro differ only in how many events and recordings they include; Agency adds client workspaces for the sites you run for clients.
          </p>
        </div>

        <div>
          <PlanBuilder onSubscribe={handleSubscribe} loading={loading} />
        </div>

      </div>
    </section>
  );
}
