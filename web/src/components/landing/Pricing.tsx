'use client';

import { isEnterprise } from '@/lib/features';
import { PlanBuilder } from '@/components/subscription/PlanBuilder';
import { useFoundingSpots } from '@/features/plans/queries';
import { usePlanSubscribe } from '@/features/billing/usePlanSubscribe';
import { useT } from '@/lib/i18n';


export default function Pricing() {
  if (!isEnterprise) return null;

  const t = useT();
  const { subscribe, loading } = usePlanSubscribe();
  const { data: founding } = useFoundingSpots();

  return (
    <section id="pricing" className="landing-section scroll-mt-20">
      <div className="landing-container">
        <div className="mb-12 grid gap-6 lg:grid-cols-2 lg:items-end lg:gap-16">
          <h2 className="lx-display text-[1.75rem] sm:text-4xl">
            {t.pricingSection.titleA}
            <br />
            <span>{t.pricingSection.titleB}</span>
          </h2>
          <p className="lx-dim max-w-md text-base leading-relaxed">
            {t.pricingSection.body}
          </p>
        </div>

        <div>
          <PlanBuilder onSubscribe={subscribe} loading={loading} founding={founding} />
        </div>

      </div>
    </section>
  );
}
