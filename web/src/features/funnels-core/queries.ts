import { useQuery } from '@tanstack/react-query';

import { isDemo, demoMutationGuard, demoFunnels, demoFunnelStats } from '@/lib/demo';
import { isValidId } from '@/lib/utils';
import { funnelKeys, getFunnel, getFunnelStats, listFunnels } from './api';
import type {
  Funnel,
  FunnelStats,
  ListFunnelsResponse,
} from './types';


export const useFunnels = (websiteId: string, limit: number = 10, offset: number = 0) => {
    return useQuery<ListFunnelsResponse>({
        queryKey: funnelKeys.list(websiteId, limit, offset),
        queryFn: () => listFunnels(websiteId, limit, offset),
        enabled: isValidId(websiteId),
        staleTime: 5 * 60 * 1000,
    });
};

export const useFunnel = (websiteId: string, funnelId: string) => {
    return useQuery<Funnel>({
        queryKey: funnelKeys.detail(websiteId, funnelId),
        queryFn: () => getFunnel(websiteId, funnelId),
        enabled: isValidId(websiteId) && !!funnelId,
        staleTime: 5 * 60 * 1000,
    });
};

export const useFunnelStats = (websiteId: string, funnelId: string, days: number = 30) => {
    return useQuery<FunnelStats>({
        queryKey: funnelKeys.stats(websiteId, funnelId, days),
        queryFn: () => getFunnelStats(websiteId, funnelId, days),
        enabled: isValidId(websiteId) && !!funnelId,
        staleTime: 5 * 60 * 1000,
    });
};
