'use client';

import { useEffect, type ReactNode } from 'react';
import { AgencyPlanPrompt } from './AgencyPlanPrompt';
import { isAgencyPlanRequired, useAgencyPlan } from '@/features/agency/plan';
import { useSetup } from '@/features/agency/queries';
import { useHomeWebsite } from './use-home-website';

/**
 * The workspace takes the Agency plan. Entitlements decide up front; a 403 `agency_plan_required`
 * from the API (read on the setup call every page shares) shows the prompt all the same.
 */
export function AgencyGate({ children }: { children: ReactNode }) {
  const { allowed, markRefused } = useAgencyPlan();
  const setup = useSetup();
  const home = useHomeWebsite();
  const refused = setup.isError && isAgencyPlanRequired(setup.error);
  useEffect(() => { if (refused) markRefused(); }, [refused, markRefused]);

  if (!allowed || refused) {
    return (
      <div className="mx-auto w-full max-w-[880px] p-4 md:p-5 lg:px-6 lg:py-10">
        <h1 className="mb-1 text-lg font-semibold tracking-tight text-foreground sm:text-xl">Agency workspace</h1>
        <p className="mb-5 text-[13px] text-muted-foreground">
          Run every client from one place: clients and their websites, white label and your own domain, usage, and the agency API.
        </p>
        <AgencyPlanPrompt websiteId={home} />
      </div>
    );
  }
  return <>{children}</>;
}
