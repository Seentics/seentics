/** Write hooks for the errors feature, with the cache invalidation each one implies. */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { demoMutationGuard } from '@/lib/demo';
import { errorsApi } from './api';
import { errorKeys } from './queries';
import type { ErrorStatus } from './types';

export function useSetErrorStatus(websiteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { fingerprint: string; status: ErrorStatus }) =>
      errorsApi.setStatus(websiteId, vars.fingerprint, vars.status),
    /*
     * Both scopes, because both can be showing the status that just changed: resolving
     * from the detail panel has to move the row in the list behind it, and the list's
     * status filter may now exclude it entirely.
     */
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: errorKeys.lists() });
      void qc.invalidateQueries({ queryKey: errorKeys.details() });
    },
  });
}

/**
 * One status for several groups, from the list's bulk bar. The API takes one group per request,
 * so they go out together; the demo answers once, not once per group.
 */
export function useSetErrorStatuses(websiteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { fingerprints: string[]; status: ErrorStatus }) => {
      if (demoMutationGuard(websiteId)) return;
      await Promise.all(vars.fingerprints.map((fp) => errorsApi.setStatus(websiteId, fp, vars.status)));
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: errorKeys.lists() });
      void qc.invalidateQueries({ queryKey: errorKeys.details() });
    },
  });
}
