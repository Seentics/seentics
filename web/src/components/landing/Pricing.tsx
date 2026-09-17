'use client';

import { useAuth } from '@/stores/useAuthStore';
import { isEnterprise } from '@/lib/features';
import { PlanBuilder, PlanSelection } from '@/components/subscription/PlanBuilder';
import api from '@/lib/api';
import { openCheckout } from '@/lib/checkout';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const CHECKOUT_INTENT_KEY = 'seentics_checkout_intent';
import { Loader2 } from 'lucide-react';

export default function Pricing() {
  if (!isEnterprise) return null;

  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
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
    <section id="pricing" className="landing-section landing-band landing-band-reverse">
      <div className="landing-container">
        <div className="mx-auto mb-10 max-w-4xl text-center">
          <p className="landing-eyebrow">Pricing</p>
          <h2 className="landing-h2 mb-4">
            Simple, <span className="">transparent pricing</span>
          </h2>
          <p className="landing-lead">
            Unlimited websites on every plan. Pay only for events.
          </p>
        </div>

        <div>
          <PlanBuilder onSubscribe={handleSubscribe} loading={loading} mode="individual" />
        </div>
      </div>
    </section>
  );
}
