/** Funnel write hooks and the cache invalidation each one implies. */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { demoMutationGuard } from '@/lib/demo';
import { funnelKeys } from '@/lib/funnels-api';
import {
  createDashboardFunnel,
  updateDashboardFunnel,
  deleteDashboardFunnel,
  bulkDeleteDashboardFunnels,
} from '@/lib/funnels-dashboard';
import { analyticsKeys } from '../analytics/queries';
import type { DashboardFunnel as Funnel } from '@/lib/funnels-dashboard';

/**
 * Funnels are keyed in two places — the legacy `analyticsKeys` namespace and
 * `funnelKeys` — so every write has to clear both or a list goes stale behind a
 * successful save. Kept private: callers should reach for the mutation hooks.
 */
const invalidateAllFunnelQueries = (qc: ReturnType<typeof useQueryClient>, websiteId?: string) => {
  qc.invalidateQueries({ queryKey: [...analyticsKeys.all, 'funnels'] });
  qc.invalidateQueries({ queryKey: [...analyticsKeys.all, 'funnel'] });
  qc.invalidateQueries({ queryKey: [...analyticsKeys.all, 'funnel-analytics'] });
  qc.invalidateQueries({ queryKey: funnelKeys.lists() });
  if (websiteId) {
    qc.invalidateQueries({ queryKey: [...analyticsKeys.all, 'funnels', websiteId] });
  }
};

export const useCreateFunnel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ websiteId, funnelData }: { websiteId: string; funnelData: Omit<Funnel, 'id' | 'website_id' | 'created_at' | 'updated_at'> }) =>
      createDashboardFunnel(websiteId, funnelData),
    onSuccess: (_, v) => {
      invalidateAllFunnelQueries(queryClient, v.websiteId);
    },
  });
};

export const useUpdateFunnel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ websiteId, funnelId, funnelData }: { websiteId: string; funnelId: string; funnelData: Partial<Funnel> }) =>
      updateDashboardFunnel(websiteId, funnelId, funnelData),
    onSuccess: (_, v) => {
      invalidateAllFunnelQueries(queryClient, v.websiteId);
    },
  });
};

export const useDeleteFunnel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ websiteId, funnelId }: { websiteId: string; funnelId: string }) =>
      deleteDashboardFunnel(websiteId, funnelId),
    onSuccess: (_, v) => {
      invalidateAllFunnelQueries(queryClient, v.websiteId);
    },
  });
};

export const useDeleteFunnels = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ websiteId, funnelIds }: { websiteId: string; funnelIds: string[] }) =>
      bulkDeleteDashboardFunnels(websiteId, funnelIds),
    onSuccess: (_, variables) => {
      invalidateAllFunnelQueries(queryClient, variables.websiteId);
    },
  });
};
