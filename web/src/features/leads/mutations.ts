/** Write hooks for the leads feature, with the cache invalidation each one implies. */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsApi } from './api';
import { leadKeys } from './queries';
import type { ContactStatus } from './types';

export function useSetContactStatus(websiteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { contactId: string; status: ContactStatus }) =>
      leadsApi.setStatus(websiteId, vars.contactId, vars.status),
    // The status shows in the list, the open detail, and may now fail the list's filter.
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: leadKeys.lists() });
      void qc.invalidateQueries({ queryKey: leadKeys.details() });
    },
  });
}

export function useDeleteContact(websiteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (contactId: string) => leadsApi.deleteContact(websiteId, contactId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: leadKeys.all }),
  });
}
