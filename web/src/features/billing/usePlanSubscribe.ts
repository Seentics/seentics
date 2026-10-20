'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { PlanSelection } from '@/components/subscription/PlanBuilder';
import { rememberCheckoutIntent, startCheckout, startInvoiceCheckout } from '@/lib/checkout';
import { useT } from '@/lib/i18n';
import { useAuth } from '@/stores/useAuthStore';

/**
 * What a pricing card's button does, for the landing page and /pricing alike. Free opens the
 * dashboard (or sign-up). A paid plan opens its checkout: Lemon Squeezy's for a card, or a taka
 * invoice for bKash, Nagad and Rocket. A visitor without an account signs up first, and the
 * dashboard then carries on to that checkout (CheckoutIntent).
 */
export function usePlanSubscribe() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const t = useT();
  const [loading, setLoading] = useState(false);

  const subscribe = async (selection: PlanSelection) => {
    if (selection.price === 0) {
      router.push(isAuthenticated ? '/websites' : '/signup');
      return;
    }
    if (!isAuthenticated) {
      rememberCheckoutIntent(selection.plan, selection.interval, selection.discount, !!selection.manual);
      router.push('/signup');
      return;
    }
    try {
      setLoading(true);
      if (selection.manual) await startInvoiceCheckout(selection.plan, selection.interval);
      else await startCheckout(selection.plan, selection.interval, selection.discount);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || error?.response?.data?.message || t.pricingSection.checkoutFailed);
    } finally {
      setLoading(false);
    }
  };

  return { subscribe, loading };
}
