'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/stores/useAuthStore';
import { startCheckout, startInvoiceCheckout, takeCheckoutIntent } from '@/lib/checkout';
import { useT } from '@/lib/i18n';

/**
 * Mounted on the dashboard: someone who chose a paid plan before signing up lands here after sign-up
 * and goes straight on to that plan's checkout, before they add a website: the card checkout, or
 * the taka invoice when that is how they chose to pay.
 */
export default function CheckoutIntent() {
  const { user } = useAuth();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!user || started.current) return;
    const intent = takeCheckoutIntent();
    if (!intent) return;
    started.current = true;
    setBusy(true);
    const go = intent.manual ? startInvoiceCheckout(intent.plan, intent.interval) : startCheckout(intent.plan, intent.interval, intent.discount);
    go.catch(() => {
      toast.error(t.checkout.openFailed);
      setBusy(false);
    });
    // Once per sign-in: changing language must not start a second checkout.
  }, [user]);

  if (!busy) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <p className="text-sm font-medium text-foreground">{t.checkout.takingYou}</p>
    </div>
  );
}
