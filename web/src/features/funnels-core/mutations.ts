import { useMutation, useQueryClient } from '@tanstack/react-query';

import { isDemo, demoMutationGuard, demoFunnels, demoFunnelStats } from '@/lib/demo';

import { ANALYTICS_FUNNEL_ANALYTICS_PREFIX, ANALYTICS_FUNNEL_QUERY_PREFIX, bulkDeleteFunnels, createFunnel, deleteFunnel, funnelKeys, updateFunnel } from './api';
import type {
  CreateFunnelRequest,
  Funnel,
  UpdateFunnelRequest,
} from './types';


export const useCreateFunnel = () => {
    const queryClient = useQueryClient();

    return useMutation<Funnel, Error, { websiteId: string; data: CreateFunnelRequest }>({
        mutationFn: ({ websiteId, data }) => createFunnel(websiteId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: funnelKeys.lists() });
            queryClient.invalidateQueries({ queryKey: [...ANALYTICS_FUNNEL_QUERY_PREFIX] });
            queryClient.invalidateQueries({ queryKey: [...ANALYTICS_FUNNEL_ANALYTICS_PREFIX] });
        },
    });
};

export const useUpdateFunnel = () => {
    const queryClient = useQueryClient();

    return useMutation<
        Funnel,
        Error,
        { websiteId: string; funnelId: string; data: UpdateFunnelRequest }
    >({
        mutationFn: ({ websiteId, funnelId, data }) => updateFunnel(websiteId, funnelId, data),
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: funnelKeys.lists() });
            queryClient.invalidateQueries({
                queryKey: funnelKeys.detail(variables.websiteId, variables.funnelId),
            });
            queryClient.invalidateQueries({ queryKey: [...ANALYTICS_FUNNEL_QUERY_PREFIX] });
            queryClient.invalidateQueries({ queryKey: [...ANALYTICS_FUNNEL_ANALYTICS_PREFIX] });
        },
    });
};

export const useDeleteFunnel = () => {
    const queryClient = useQueryClient();

    return useMutation<void, Error, { websiteId: string; funnelId: string }>({
        mutationFn: ({ websiteId, funnelId }) => deleteFunnel(websiteId, funnelId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: funnelKeys.lists() });
            queryClient.invalidateQueries({ queryKey: [...ANALYTICS_FUNNEL_QUERY_PREFIX] });
            queryClient.invalidateQueries({ queryKey: [...ANALYTICS_FUNNEL_ANALYTICS_PREFIX] });
        },
    });
};

export const useBulkDeleteFunnels = () => {
    const queryClient = useQueryClient();

    return useMutation<void, Error, { websiteId: string; funnelIds: string[] }>({
        mutationFn: ({ websiteId, funnelIds }) => bulkDeleteFunnels(websiteId, funnelIds),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: funnelKeys.lists() });
            queryClient.invalidateQueries({ queryKey: [...ANALYTICS_FUNNEL_QUERY_PREFIX] });
            queryClient.invalidateQueries({ queryKey: [...ANALYTICS_FUNNEL_ANALYTICS_PREFIX] });
        },
    });
};
