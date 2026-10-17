import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEntitlements } from '@/features/suite/queries';
import { isDemo } from '@/lib/demo';
import { isEnterprise } from '@/lib/features';

/**
 * The gateway's refusal without the Agency plan: creating a client, an agency website or an embed
 * link, and anything at all to do with client access, white label and the custom domain.
 */
export const AGENCY_PLAN_REQUIRED = 'AGENCY_PLAN_REQUIRED';

export const isAgencyPlanRequired = (e: unknown): boolean => {
  const response = (e as { response?: { status?: number; data?: { error?: string } } })?.response;
  return response?.status === 403 && response.data?.error === AGENCY_PLAN_REQUIRED;
};

const refusedKey = ['agency-plan-refused'] as const;

/**
 * Whether this account has the Agency plan: `core.agency_features` in its entitlements, which only
 * that plan grants. The gateway refuses every agency route without it, reads included (clients,
 * agency websites, embed links, client access, white label, the custom domain; API keys excepted),
 * so their screens show the upgrade prompt in place of the feature. The open-source build and the demo site have
 * no plans, so everything is allowed there; until the entitlements load, nothing is hidden, and a
 * 403 AGENCY_PLAN_REQUIRED from the API (`markRefused`) shows the prompt all the same.
 */
export function useAgencyPlan(websiteId: string) {
  const queryClient = useQueryClient();
  const { data: entitlements } = useEntitlements();
  const { data: refused } = useQuery({
    queryKey: refusedKey,
    queryFn: () => false,
    initialData: false,
    staleTime: Infinity,
  });
  const markRefused = useCallback(() => queryClient.setQueryData(refusedKey, true), [queryClient]);

  if (!isEnterprise || isDemo(websiteId)) return { allowed: true, markRefused };
  const granted = entitlements ? (entitlements.products?.core?.limits?.agency_features ?? 0) > 0 : true;
  return { allowed: granted && !refused, markRefused };
}
