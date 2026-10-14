/** Write hooks for a form's submissions, with the cache invalidation each one implies. */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { submissionsApi } from './api';
import { submissionKeys } from './queries';

export function useDeleteSubmission(websiteId: string, automationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (submissionId: string) => submissionsApi.remove(websiteId, automationId, submissionId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: submissionKeys.all }),
  });
}
