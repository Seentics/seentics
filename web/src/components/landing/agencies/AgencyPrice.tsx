'use client';

import { usePlans } from '@/features/plans/queries';
import { formatMoney } from '@/features/plans/pricing-spec';

/** Agency's list price, from the plan catalogue, with the published figures until it answers. */
const FALLBACK = { monthly: 99, yearly: 990 };

export function AgencyPrice() {
  const { data: plans } = usePlans();
  const agency = plans?.find((p) => p.tier === 'agency');
  const monthly = agency?.priceMonthly || FALLBACK.monthly;
  const yearly = agency ? agency.priceYearly : FALLBACK.yearly;

  return (
    <div>
      <p className="flex items-baseline gap-1.5">
        <span className="lx-display text-5xl">{formatMoney(monthly)}</span>
        <span className="lx-dim text-base">/ month</span>
      </p>
      {yearly ? <p className="lx-dim mt-1 text-sm">or {formatMoney(yearly)} a year</p> : null}
    </div>
  );
}
