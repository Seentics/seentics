/** Write hooks for a form's submissions and the Leads page, with the cache invalidation each one implies. */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsApi, submissionsApi } from './api';
import { leadKeys, submissionKeys } from './queries';
import type { ContactBulkChange, ContactInput, ContactPatch, ImportRow } from './types';

export function useDeleteSubmission(websiteId: string, automationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (submissionId: string) => submissionsApi.remove(websiteId, automationId, submissionId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: submissionKeys.all }),
  });
}

// ── Site-wide: the Leads page ────────────────────────────────────────────────


/** Every leads write can change both lists (a deleted contact can take its submissions with it). */
function useInvalidateLeads() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: leadKeys.all });
    void qc.invalidateQueries({ queryKey: submissionKeys.all });
  };
}

export function useDeleteSiteSubmission(websiteId: string) {
  const invalidate = useInvalidateLeads();
  return useMutation({ mutationFn: (submissionId: string) => leadsApi.removeSubmission(websiteId, submissionId), onSuccess: invalidate });
}

export function useAddContact(websiteId: string) {
  const invalidate = useInvalidateLeads();
  return useMutation({ mutationFn: (input: ContactInput) => leadsApi.addContact(websiteId, input), onSuccess: invalidate });
}

export function useUpdateContact(websiteId: string) {
  const invalidate = useInvalidateLeads();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ContactPatch }) => leadsApi.updateContact(websiteId, id, patch),
    onSuccess: invalidate,
  });
}

export function useBulkUpdateContacts(websiteId: string) {
  const invalidate = useInvalidateLeads();
  return useMutation({ mutationFn: (change: ContactBulkChange) => leadsApi.bulkUpdate(websiteId, change), onSuccess: invalidate });
}

export function useDeleteContacts(websiteId: string) {
  const invalidate = useInvalidateLeads();
  return useMutation({
    mutationFn: ({ ids, withSubmissions }: { ids: string[]; withSubmissions: boolean }) => leadsApi.deleteContacts(websiteId, ids, withSubmissions),
    onSuccess: invalidate,
  });
}

/** Sends the rows in chunks the server accepts, and adds up what each chunk did. Row numbers stay relative to the whole file. */
export const IMPORT_CHUNK = 5_000;
export function useImportContacts(websiteId: string) {
  const invalidate = useInvalidateLeads();
  return useMutation({
    mutationFn: async ({ rows, updateExisting }: { rows: ImportRow[]; updateExisting: boolean }) => {
      const total = { created: 0, updated: 0, skipped: 0, errors: [] as { row: number; reason: string }[] };
      for (let start = 0; start < rows.length; start += IMPORT_CHUNK) {
        const r = await leadsApi.importContacts(websiteId, rows.slice(start, start + IMPORT_CHUNK), updateExisting);
        total.created += r.created;
        total.updated += r.updated;
        total.skipped += r.skipped;
        total.errors.push(...r.errors.map((e) => ({ ...e, row: e.row + start })));
      }
      return total;
    },
    onSuccess: invalidate,
  });
}
