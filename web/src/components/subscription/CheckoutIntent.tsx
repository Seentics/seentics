'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/stores/useAuthStore';
import { startCheckout, takeCheckoutIntent } from '@/lib/checkout';

/**
 * Mounted on the dashboard: someone who chose a paid plan before signing up lands here after sign-up
 * and goes straight on to that plan's checkout, before they add a website.
 */
export default function CheckoutIntent() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!user || started.current) return;
    const plan = takeCheckoutIntent();
    if (!plan) return;
    started.current = true;
    setBusy(true);
    startCheckout(plan)
      .then((result) => {
        if (result.kind === 'changed') {
          toast.success('Plan changed. The difference is prorated on your bill.');
          setBusy(false);
        }
      })
      .catch(() => {
        toast.error('Could not open the checkout. Choose your plan again from Billing.');
        setBusy(false);
      });
  }, [user]);

  if (!busy) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <p className="text-sm font-medium text-foreground">Taking you to checkout…</p>
    </div>
  );
}
