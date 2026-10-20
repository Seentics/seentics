'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { BillingShell } from '@/components/subscription/BillingShell';
import { isEnterprise } from '@/lib/features';
import { rememberedWebsite } from '@/lib/last-website';

/**
 * Where the billing emails point ("View billing", "See plans"). Billing lives in a website's
 * settings, so this opens the last website's; with none remembered, the pricing.
 */
export default function BillingPage() {
  const router = useRouter();

  useEffect(() => {
    const website = rememberedWebsite();
    if (!isEnterprise) router.replace('/websites');
    else if (website) router.replace(`/websites/${website}/settings/billing`);
    else router.replace('/pricing');
  }, [router]);

  return (
    <BillingShell>
      <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
    </BillingShell>
  );
}
