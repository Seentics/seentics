/** Read and write hooks for recommendations. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { aiKeys } from '../queries';
import { recommendationsApi } from './api';
import { VISIBLE_STATUSES } from './helpers';

export const recommendationKeys = {
  list: (websiteId: string) => [...aiKeys.all, 'recommendations', websiteId] as const,
};

export function useRecommendations(websiteId: string, enabled = true) {
  return useQuery({
    queryKey: recommendationKeys.list(websiteId),
    queryFn: () => recommendationsApi.list(websiteId, [...VISIBLE_STATUSES]),
    enabled: enabled && !!websiteId,
    // Collected and measured once a day; the actions below update the cache.
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
}

export function useRecommendationAction(websiteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; action: 'dismiss' | 'done' }) =>
      vars.action === 'dismiss'
        ? recommendationsApi.dismiss(websiteId, vars.id)
        : recommendationsApi.markDone(websiteId, vars.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: recommendationKeys.list(websiteId) });
    },
  });
}
