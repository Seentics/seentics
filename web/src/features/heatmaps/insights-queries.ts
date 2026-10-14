/** Read and refresh hooks for one page's heatmap insights. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { heatmapInsightsApi, type InsightDevice } from './insights';

export const heatmapInsightKeys = {
  page: (websiteId: string, pagePath: string, days: number, device: InsightDevice) =>
    ['heatmap-insights', websiteId, pagePath, days, device] as const,
};

export function useHeatmapInsights(websiteId: string, pagePath: string, days: number, device: InsightDevice, enabled = true) {
  return useQuery({
    queryKey: heatmapInsightKeys.page(websiteId, pagePath, days, device),
    queryFn: () => heatmapInsightsApi.get(websiteId, pagePath, days, device),
    enabled: enabled && !!websiteId && websiteId !== 'demo' && !!pagePath,
    // The wording is stored server-side for a day; the numbers move slowly.
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useRefreshHeatmapInsights(websiteId: string, pagePath: string, days: number, device: InsightDevice) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => heatmapInsightsApi.refresh(websiteId, pagePath, days, device),
    onSuccess: (outcome) => {
      if (outcome.kind === 'refreshed') {
        qc.setQueryData(heatmapInsightKeys.page(websiteId, pagePath, days, device), outcome.data);
      }
    },
  });
}
