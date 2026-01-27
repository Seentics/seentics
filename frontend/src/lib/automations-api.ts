import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api/v1';

// Types
export interface AutomationAction {
    id?: string;
    automationId?: string;
    actionType: 'webhook' | 'email' | 'script' | 'banner';
    actionConfig: Record<string, any>;
    orderIndex?: number;
}

export interface AutomationCondition {
    id?: string;
    automationId?: string;
    conditionType: string;
    conditionConfig: Record<string, any>;
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
    triggerType: string;
    triggerConfig: Record<string, any>;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    actions: AutomationAction[];
    conditions?: AutomationCondition[];
    stats?: AutomationStats;
}

export interface CreateAutomationRequest {
    name: string;
    description?: string;
    triggerType: string;
    triggerConfig?: Record<string, any>;
    actions: AutomationAction[];
    conditions?: AutomationCondition[];
}

// API Functions
async function fetchAutomations(websiteId: string, token: string): Promise<{ automations: Automation[]; total: number }> {
    const response = await fetch(`${API_URL}/websites/${websiteId}/automations`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        throw new Error('Failed to fetch automations');
    }

    return response.json();
}

async function createAutomation(websiteId: string, data: CreateAutomationRequest, token: string): Promise<Automation> {
    const response = await fetch(`${API_URL}/websites/${websiteId}/automations`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create automation');
    }

    return response.json();
}

async function updateAutomation(websiteId: string, automationId: string, data: Partial<CreateAutomationRequest>, token: string): Promise<Automation> {
    const response = await fetch(`${API_URL}/websites/${websiteId}/automations/${automationId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        throw new Error('Failed to update automation');
    }

    return response.json();
}

async function deleteAutomation(websiteId: string, automationId: string, token: string): Promise<void> {
    const response = await fetch(`${API_URL}/websites/${websiteId}/automations/${automationId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        throw new Error('Failed to delete automation');
    }
}

async function toggleAutomation(websiteId: string, automationId: string, token: string): Promise<Automation> {
    const response = await fetch(`${API_URL}/websites/${websiteId}/automations/${automationId}/toggle`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        throw new Error('Failed to toggle automation');
    }

    return response.json();
}

async function getAutomationStats(websiteId: string, automationId: string, token: string): Promise<AutomationStats> {
    const response = await fetch(`${API_URL}/websites/${websiteId}/automations/${automationId}/stats`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        throw new Error('Failed to fetch automation stats');
    }

    return response.json();
}

// React Query Hooks
export function useAutomations(websiteId: string) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') || '' : '';

    return useQuery({
        queryKey: ['automations', websiteId],
        queryFn: () => fetchAutomations(websiteId, token),
        enabled: !!websiteId && !!token,
    });
}

export function useCreateAutomation() {
    const queryClient = useQueryClient();
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') || '' : '';

    return useMutation({
        mutationFn: ({ websiteId, data }: { websiteId: string; data: CreateAutomationRequest }) =>
            createAutomation(websiteId, data, token),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['automations', variables.websiteId] });
        },
    });
}

export function useUpdateAutomation() {
    const queryClient = useQueryClient();
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') || '' : '';

    return useMutation({
        mutationFn: ({ websiteId, automationId, data }: { websiteId: string; automationId: string; data: Partial<CreateAutomationRequest> }) =>
            updateAutomation(websiteId, automationId, data, token),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['automations', variables.websiteId] });
        },
    });
}

export function useDeleteAutomation() {
    const queryClient = useQueryClient();
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') || '' : '';

    return useMutation({
        mutationFn: ({ websiteId, automationId }: { websiteId: string; automationId: string }) =>
            deleteAutomation(websiteId, automationId, token),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['automations', variables.websiteId] });
        },
    });
}

export function useToggleAutomation() {
    const queryClient = useQueryClient();
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') || '' : '';

    return useMutation({
        mutationFn: ({ websiteId, automationId }: { websiteId: string; automationId: string }) =>
            toggleAutomation(websiteId, automationId, token),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['automations', variables.websiteId] });
        },
    });
}

export function useAutomationStats(websiteId: string, automationId: string) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') || '' : '';

    return useQuery({
        queryKey: ['automation-stats', websiteId, automationId],
        queryFn: () => getAutomationStats(websiteId, automationId, token),
        enabled: !!websiteId && !!automationId && !!token,
    });
}
