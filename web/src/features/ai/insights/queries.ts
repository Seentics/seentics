/** Read and write hooks for the daily insight. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { aiKeys } from '../queries';
import { insightsApi } from './api';

export const insightKeys = {
  today: (websiteId: string) => [...aiKeys.all, 'insights', websiteId] as const,
};

export function useDailyInsight(websiteId: string, enabled = true) {
  return useQuery({
    queryKey: insightKeys.today(websiteId),
    queryFn: () => insightsApi.today(websiteId),
    enabled: enabled && !!websiteId && websiteId !== 'demo',
    // Generated once a day; a refresh writes the cache directly.
    staleTime: 15 * 60 * 1000,
    retry: 1,
  });
}

export function useRefreshInsight(websiteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => insightsApi.refresh(websiteId),
    onSuccess: (outcome) => {
      // A cooldown can still carry the current insight; either way it is the newest copy.
      if (outcome.kind !== 'forbidden' && outcome.data) {
        qc.setQueryData(insightKeys.today(websiteId), outcome.data);
      }
    },
  });
}
