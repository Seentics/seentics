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
      rememberCheckoutIntent(selection.plan);
      router.push('/signup');
      return;
    }
    try {
      setLoading(true);
      const result = await startCheckout(selection.plan);
      if (result.kind === 'changed') {
        toast.success('Plan changed. The difference is prorated on your bill.');
        router.push('/websites');
      }
    } catch {
      toast.error('Failed to initialize checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="pricing" className="landing-section landing-band landing-band-reverse">
      <div className="landing-container">
        <div className="mx-auto mb-10 max-w-4xl text-center">
          <p className="landing-eyebrow">Pricing</p>
          <h2 className="landing-h2 mb-4">
            Simple, <span className="">transparent pricing</span>
          </h2>
          <p className="landing-lead">
            Start free with unlimited websites. Take the whole suite, or just analytics.
          </p>
        </div>

        <div>
          <PlanBuilder onSubscribe={handleSubscribe} loading={loading} families={['suite', 'core']} />
        </div>
      </div>
    </section>
  );
}
