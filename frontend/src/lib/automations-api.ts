import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from './api';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface AutomationAction {
    id?: string;
    automationId?: string;
    actionType: string; // 'email', 'webhook', 'slack', 'discord', 'custom'
    actionConfig: Record<string, any>;
    orderIndex?: number;
    createdAt?: string;
    updatedAt?: string;
}

export interface AutomationCondition {
    id?: string;
    automationId?: string;
    conditionType: string; // 'visitor_count', 'time_range', 'device_type', 'country', 'custom'
    conditionConfig: Record<string, any>;
    createdAt?: string;
}

export interface AutomationStats {
    totalExecutions: number;
    successCount: number;
    failureCount: number;
    successRate: number;
    last30Days: number;
}

export interface Automation {
    id: string;
    websiteId: string;
    userId: string;
    name: string;
    description: string;
    triggerType: string; // 'event', 'page_visit', 'time_based', 'utm_campaign'
    triggerConfig: Record<string, any>;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    actions?: AutomationAction[];
    conditions?: AutomationCondition[];
    stats?: AutomationStats;
}

export interface CreateAutomationRequest {
    name: string;
    description?: string;
    triggerType: string;
    triggerConfig?: Record<string, any>;
    actions: Omit<AutomationAction, 'id' | 'automationId' | 'createdAt' | 'updatedAt' | 'orderIndex'>[];
    conditions?: Omit<AutomationCondition, 'id' | 'automationId' | 'createdAt'>[];
}

export interface UpdateAutomationRequest {
    name?: string;
    description?: string;
    triggerType?: string;
    triggerConfig?: Record<string, any>;
    isActive?: boolean;
    actions?: Omit<AutomationAction, 'id' | 'automationId' | 'createdAt' | 'updatedAt' | 'orderIndex'>[];
    conditions?: Omit<AutomationCondition, 'id' | 'automationId' | 'createdAt'>[];
}

export interface ListAutomationsResponse {
    automations: Automation[];
    total: number;
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

// List all automations for a website
export const listAutomations = async (websiteId: string): Promise<ListAutomationsResponse> => {
    const response = await api.get(`/websites/${websiteId}/automations`);
    return response.data;
};

// Get a single automation by ID
export const getAutomation = async (websiteId: string, automationId: string): Promise<Automation> => {
    const response = await api.get(`/websites/${websiteId}/automations/${automationId}`);
    return response.data;
};

// Create a new automation
export const createAutomation = async (
    websiteId: string,
    data: CreateAutomationRequest
): Promise<Automation> => {
    const response = await api.post(`/websites/${websiteId}/automations`, data);
    return response.data;
};

// Update an existing automation
export const updateAutomation = async (
    websiteId: string,
    automationId: string,
    data: UpdateAutomationRequest
): Promise<Automation> => {
    const response = await api.put(`/websites/${websiteId}/automations/${automationId}`, data);
    return response.data;
};

// Delete an automation
export const deleteAutomation = async (websiteId: string, automationId: string): Promise<void> => {
    await api.delete(`/websites/${websiteId}/automations/${automationId}`);
};

// Toggle automation active status
export const toggleAutomation = async (websiteId: string, automationId: string): Promise<Automation> => {
    const response = await api.post(`/websites/${websiteId}/automations/${automationId}/toggle`);
    return response.data;
};

// Get automation statistics
export const getAutomationStats = async (websiteId: string, automationId: string): Promise<AutomationStats> => {
    const response = await api.get(`/websites/${websiteId}/automations/${automationId}/stats`);
    return response.data;
};

// =============================================================================
// QUERY KEYS
// =============================================================================

export const automationKeys = {
    all: ['automations'] as const,
    lists: () => [...automationKeys.all, 'list'] as const,
    list: (websiteId: string) => [...automationKeys.lists(), websiteId] as const,
    details: () => [...automationKeys.all, 'detail'] as const,
    detail: (websiteId: string, automationId: string) => [...automationKeys.details(), websiteId, automationId] as const,
    stats: (websiteId: string, automationId: string) => [...automationKeys.all, 'stats', websiteId, automationId] as const,
};

// =============================================================================
// REACT QUERY HOOKS
// =============================================================================

// List automations hook
export const useAutomations = (websiteId: string) => {
    return useQuery<ListAutomationsResponse>({
        queryKey: automationKeys.list(websiteId),
        queryFn: () => listAutomations(websiteId),
        enabled: !!websiteId,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
};

// Get single automation hook
export const useAutomation = (websiteId: string, automationId: string) => {
    return useQuery<Automation>({
        queryKey: automationKeys.detail(websiteId, automationId),
        queryFn: () => getAutomation(websiteId, automationId),
        enabled: !!websiteId && !!automationId,
        staleTime: 5 * 60 * 1000,
    });
};

// Get automation stats hook
export const useAutomationStats = (websiteId: string, automationId: string) => {
    return useQuery<AutomationStats>({
        queryKey: automationKeys.stats(websiteId, automationId),
        queryFn: () => getAutomationStats(websiteId, automationId),
        enabled: !!websiteId && !!automationId,
        staleTime: 2 * 60 * 1000, // 2 minutes
    });
};

// =============================================================================
// MUTATION HOOKS
// =============================================================================

// Create automation mutation
export const useCreateAutomation = () => {
    const queryClient = useQueryClient();

    return useMutation<Automation, Error, { websiteId: string; data: CreateAutomationRequest }>({
        mutationFn: ({ websiteId, data }) => createAutomation(websiteId, data),
        onSuccess: (_, variables) => {
            // Invalidate the list to refetch
            queryClient.invalidateQueries({
                queryKey: automationKeys.list(variables.websiteId),
            });
        },
    });
};

// Update automation mutation
export const useUpdateAutomation = () => {
    const queryClient = useQueryClient();

    return useMutation<
        Automation,
        Error,
        { websiteId: string; automationId: string; data: UpdateAutomationRequest }
    >({
        mutationFn: ({ websiteId, automationId, data }) => updateAutomation(websiteId, automationId, data),
        onSuccess: (data, variables) => {
            // Invalidate both list and detail
            queryClient.invalidateQueries({
                queryKey: automationKeys.list(variables.websiteId),
            });
            queryClient.invalidateQueries({
                queryKey: automationKeys.detail(variables.websiteId, variables.automationId),
            });
        },
    });
};

// Delete automation mutation
export const useDeleteAutomation = () => {
    const queryClient = useQueryClient();

    return useMutation<void, Error, { websiteId: string; automationId: string }>({
        mutationFn: ({ websiteId, automationId }) => deleteAutomation(websiteId, automationId),
        onSuccess: (_, variables) => {
            // Invalidate the list
            queryClient.invalidateQueries({
                queryKey: automationKeys.list(variables.websiteId),
            });
        },
    });
};

// Toggle automation mutation
export const useToggleAutomation = () => {
    const queryClient = useQueryClient();

    return useMutation<Automation, Error, { websiteId: string; automationId: string }>({
        mutationFn: ({ websiteId, automationId }) => toggleAutomation(websiteId, automationId),
        onSuccess: (data, variables) => {
            // Update both list and detail
            queryClient.invalidateQueries({
                queryKey: automationKeys.list(variables.websiteId),
            });
            queryClient.invalidateQueries({
                queryKey: automationKeys.detail(variables.websiteId, variables.automationId),
            });
        },
    });
};
