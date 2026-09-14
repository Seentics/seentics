import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { isDemo, demoMutationGuard, demoFunnels, demoFunnelStats } from '@/lib/demo';
import { isValidId } from '@/lib/utils';
import type {
  CreateFunnelRequest,
  Funnel,
  FunnelStats,
  ListFunnelsResponse,
  UpdateFunnelRequest,
} from './types';


/** Invalidate dashboard React Query trees from funnel CRUD (matches analytics-api keys). */
export const ANALYTICS_FUNNEL_QUERY_PREFIX = ['analytics', 'funnels'] as const;

export const ANALYTICS_FUNNEL_ANALYTICS_PREFIX = ['analytics', 'funnel-analytics'] as const;

export const listFunnels = async (websiteId: string, limit: number = 10, offset: number = 0): Promise<ListFunnelsResponse> => {
    if (isDemo(websiteId)) {
        const demo = demoFunnels();
        return { funnels: demo.funnels as any, total: demo.total };
    }
    const response = await api.get(`/websites/${websiteId}/funnels`, {
        params: { limit, offset }
    });
    return response.data;
};

export const getFunnel = async (websiteId: string, funnelId: string): Promise<Funnel> => {
    if (isDemo(websiteId)) {
        return demoFunnels().funnels.find((f: any) => f.id === funnelId) as any;
    }
    const response = await api.get(`/websites/${websiteId}/funnels/${funnelId}`);
    return response.data;
};

export const createFunnel = async (
    websiteId: string,
    data: CreateFunnelRequest
): Promise<Funnel> => {
    if (demoMutationGuard(websiteId)) {
        return { id: 'demo-new', websiteId, userId: 'demo', name: data.name, description: data.description || '', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), steps: data.steps as any } as Funnel;
    }
    const response = await api.post(`/websites/${websiteId}/funnels`, data);
    return response.data;
};

export const updateFunnel = async (
    websiteId: string,
    funnelId: string,
    data: UpdateFunnelRequest
): Promise<Funnel> => {
    if (demoMutationGuard(websiteId)) {
        const existing = demoFunnels().funnels.find((f: any) => f.id === funnelId);
        return { ...existing, ...data, updatedAt: new Date().toISOString() } as any;
    }
    const response = await api.put(`/websites/${websiteId}/funnels/${funnelId}`, data);
    return response.data;
};

export const deleteFunnel = async (websiteId: string, funnelId: string): Promise<void> => {
    if (demoMutationGuard(websiteId)) return;
    await api.delete(`/websites/${websiteId}/funnels/${funnelId}`);
};

export const bulkDeleteFunnels = async (websiteId: string, funnelIds: string[]): Promise<void> => {
    if (demoMutationGuard(websiteId)) return;
    await api.delete(`/websites/${websiteId}/funnels/bulk-delete`, {
        data: { funnelIds }
    });
};

export const getFunnelStats = async (
    websiteId: string,
    funnelId: string,
    days: number = 30
): Promise<FunnelStats> => {
    if (isDemo(websiteId)) {
        return demoFunnelStats() as any;
    }
    const d = Math.min(366, Math.max(1, Math.round(Number(days) || 30)));
    const response = await api.get(`/websites/${websiteId}/funnels/${funnelId}/stats`, {
        params: { days: d },
    });
    return response.data;
};

export const funnelKeys = {
    all: ['funnels'] as const,
    lists: () => [...funnelKeys.all, 'list'] as const,
    list: (websiteId: string, limit?: number, offset?: number) => [...funnelKeys.lists(), websiteId, limit, offset] as const,
    details: () => [...funnelKeys.all, 'detail'] as const,
    detail: (websiteId: string, funnelId: string) => [...funnelKeys.details(), websiteId, funnelId] as const,
    stats: (websiteId: string, funnelId: string, days?: number) =>
        [...funnelKeys.all, 'stats', websiteId, funnelId, days ?? 30] as const,
};
