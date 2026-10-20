'use client';

import { useEffect, type ReactNode } from 'react';
import { AgencyPlanPrompt } from './AgencyPlanPrompt';
import { isAgencyPlanRequired, useAgencyPlan } from '@/features/agency/plan';
import { useSetup } from '@/features/agency/queries';
import { useAgencyDemo } from '@/lib/demo/agency-mode';
import { useT } from '@/lib/i18n';
import { useHomeWebsite } from './use-home-website';

/**
 * The workspace takes the Agency plan (the agency demo, `?demo=1`, excepted). Entitlements decide up front; a 403 `agency_plan_required`
 * from the API (read on the setup call every page shares) shows the prompt all the same.
 */
export function AgencyGate({ children }: { children: ReactNode }) {
  const demo = useAgencyDemo();
  // Until the demo switch is read (after mount), nothing: no entitlements or API call goes out
  // for a visitor who is only looking at the demo. The demo has no plan to check.
  if (demo === null) return null;
  if (demo) return <>{children}</>;
  return <PlanGate>{children}</PlanGate>;
}

function PlanGate({ children }: { children: ReactNode }) {
  const t = useT().agency.gate;
  const { allowed, markRefused } = useAgencyPlan();
  const setup = useSetup();
  const home = useHomeWebsite();
  const refused = setup.isError && isAgencyPlanRequired(setup.error);
  useEffect(() => { if (refused) markRefused(); }, [refused, markRefused]);

  if (!allowed || refused) {
    return (
      <div className="mx-auto w-full max-w-[880px] p-4 md:p-5 lg:px-6 lg:py-10">
        <h1 className="mb-1 text-lg font-semibold tracking-tight text-foreground sm:text-xl">{t.title}</h1>
        <p className="mb-5 text-[13px] text-muted-foreground">
          {t.body}
        </p>
        <AgencyPlanPrompt websiteId={home} />
      </div>
    );
  }
  return <>{children}</>;
}
