import { useQuery } from '@tanstack/react-query';
import { isEnterprise } from '@/lib/features';
import { fetchEntitlements, suiteKeys } from './api';

/**
 * Only meaningful in enterprise/managed mode — OSS deployments have no
 * gateway to ask and every product is locally unlimited. `enabled` keeps this
 * from ever firing a request in OSS builds rather than failing quietly.
 */
export function useEntitlements() {
  return useQuery({
    queryKey: suiteKeys.entitlements,
    queryFn: fetchEntitlements,
    enabled: isEnterprise,
    staleTime: 60_000,
    retry: false,
  });
}
