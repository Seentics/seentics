/** Write hooks for the errors feature, with the cache invalidation each one implies. */
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
