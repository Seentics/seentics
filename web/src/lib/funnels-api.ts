import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from './api';
import { isDemo, demoMutationGuard, demoFunnels, demoFunnelStats } from './demo';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface FunnelStep {
    id?: string;
    funnelId?: string;
    name: string;
    order: number;
    stepType: 'page_view' | 'event';
    pagePath?: string;
    eventType?: string;
    matchType?: 'exact' | 'contains' | 'starts_with' | 'regex';
}

export interface StepStats {
    stepOrder: number;
    stepName: string;
    count: number;
    dropoffCount: number;
    dropoffRate: number;
    conversionRate: number;
}

export interface FunnelStats {
    totalEntries: number;
    completions: number;
    conversionRate: number;
    stepBreakdown: StepStats[];
}

export interface Funnel {
    id: string;
    websiteId: string;
    userId: string;
    name: string;
    description: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    steps?: FunnelStep[];
    stats?: FunnelStats;
}

export interface CreateFunnelRequest {
    name: string;
    description?: string;
    steps: Omit<FunnelStep, 'id' | 'funnelId'>[];
}

export interface UpdateFunnelRequest {
    name?: string;
    description?: string;
    isActive?: boolean;
    steps?: Omit<FunnelStep, 'id' | 'funnelId'>[];
}

export interface ListFunnelsResponse {
    funnels: Funnel[];
    total: number;
    limit?: number;
    offset?: number;
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

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

export const getFunnelStats = async (websiteId: string, funnelId: string): Promise<FunnelStats> => {
    if (isDemo(websiteId)) {
        return demoFunnelStats() as any;
    }
    const response = await api.get(`/websites/${websiteId}/funnels/${funnelId}/stats`);
    return response.data;
};

// =============================================================================
// QUERY KEYS
// =============================================================================

export const funnelKeys = {
    all: ['funnels'] as const,
    lists: () => [...funnelKeys.all, 'list'] as const,
    list: (websiteId: string, limit?: number, offset?: number) => [...funnelKeys.lists(), websiteId, limit, offset] as const,
    details: () => [...funnelKeys.all, 'detail'] as const,
    detail: (websiteId: string, funnelId: string) => [...funnelKeys.details(), websiteId, funnelId] as const,
    stats: (websiteId: string, funnelId: string) => [...funnelKeys.all, 'stats', websiteId, funnelId] as const,
};

// =============================================================================
// REACT QUERY HOOKS
// =============================================================================

export const useFunnels = (websiteId: string, limit: number = 10, offset: number = 0) => {
    return useQuery<ListFunnelsResponse>({
        queryKey: funnelKeys.list(websiteId, limit, offset),
        queryFn: () => listFunnels(websiteId, limit, offset),
        enabled: !!websiteId,
        staleTime: 5 * 60 * 1000,
    });
};

export const useFunnel = (websiteId: string, funnelId: string) => {
    return useQuery<Funnel>({
        queryKey: funnelKeys.detail(websiteId, funnelId),
        queryFn: () => getFunnel(websiteId, funnelId),
        enabled: !!websiteId && !!funnelId,
        staleTime: 5 * 60 * 1000,
    });
};

export const useFunnelStats = (websiteId: string, funnelId: string) => {
    return useQuery<FunnelStats>({
        queryKey: funnelKeys.stats(websiteId, funnelId),
        queryFn: () => getFunnelStats(websiteId, funnelId),
        enabled: !!websiteId && !!funnelId,
        staleTime: 5 * 60 * 1000,
    });
};

// =============================================================================
// MUTATION HOOKS
// =============================================================================

export const useCreateFunnel = () => {
    const queryClient = useQueryClient();

    return useMutation<Funnel, Error, { websiteId: string; data: CreateFunnelRequest }>({
        mutationFn: ({ websiteId, data }) => createFunnel(websiteId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: funnelKeys.lists(),
            });
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
            queryClient.invalidateQueries({
                queryKey: funnelKeys.lists(),
            });
            queryClient.invalidateQueries({
                queryKey: funnelKeys.detail(variables.websiteId, variables.funnelId),
            });
        },
    });
};

export const useDeleteFunnel = () => {
    const queryClient = useQueryClient();

    return useMutation<void, Error, { websiteId: string; funnelId: string }>({
        mutationFn: ({ websiteId, funnelId }) => deleteFunnel(websiteId, funnelId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: funnelKeys.lists(),
            });
        },
    });
};

export const useBulkDeleteFunnels = () => {
    const queryClient = useQueryClient();

    return useMutation<void, Error, { websiteId: string; funnelIds: string[] }>({
        mutationFn: ({ websiteId, funnelIds }) => bulkDeleteFunnels(websiteId, funnelIds),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: funnelKeys.lists(),
            });
        },
    });
};
