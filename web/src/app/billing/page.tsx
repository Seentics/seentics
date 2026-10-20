'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { BillingShell } from '@/components/subscription/BillingShell';
import { TakaBilling } from '@/components/subscription/TakaBilling';
import { useInvoices, useManualSubscription } from '@/features/billing/queries';
import { isEnterprise } from '@/lib/features';
import { offersManualPayments, useLocale, useT } from '@/lib/i18n';
import { rememberedWebsite } from '@/lib/last-website';

/**
 * Where the billing emails point ("View billing", "See plans"). Billing lives in a website's
 * settings, so this opens the last website's; with none remembered, an account that pays in taka
 * sees its plan and invoices here, and anyone else the pricing.
 */
export default function BillingPage() {
  const router = useRouter();
  const t = useT();
  const { region } = useLocale();
  const website = typeof window === 'undefined' ? null : rememberedWebsite();
  const manual = useManualSubscription({ enabled: isEnterprise && !website });
  const invoices = useInvoices({ enabled: isEnterprise && !website });
  // The gateway's rule (billing/manual.ts mayPayManually): in Bangladesh now, or paid in taka
  // before. Without the second half, a customer abroad whose taka plan had lapsed was sent to the
  // card pricing although the gateway would still invoice them.
  const paidInTakaBefore = !!invoices.data?.some((i) => i.status === 'paid');
  const paysInTaka = !!manual.data || paidInTakaBefore || offersManualPayments(region);

  useEffect(() => {
    if (!isEnterprise) router.replace('/websites');
    else if (website) router.replace(`/websites/${website}/settings/billing`);
    else if (manual.isFetched && invoices.isFetched && !paysInTaka && region) router.replace('/pricing');
  }, [router, website, manual.isFetched, invoices.isFetched, paysInTaka, region]);

  return (
    <BillingShell>
      {website || !paysInTaka ? (
        <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-6">
          <h1 className="text-2xl font-semibold">{t.billing.title}</h1>
          <TakaBilling demo={false} />
        </div>
      )}
    </BillingShell>
  );
}
