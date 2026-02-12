import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './api';

// Types
export interface AutomationAction {
    id?: string;
    automationId?: string;
    actionType: 'webhook' | 'email' | 'script' | 'banner' | 'modal' | 'notification' | 'redirect' | 'hide_element';
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
async function fetchAutomations(websiteId: string): Promise<{ automations: Automation[]; total: number }> {
    if (websiteId === 'demo') {
        return {
            automations: [
                {
                    id: 'demo-1',
                    websiteId: 'demo',
                    userId: 'demo',
                    name: 'Welcome Email',
                    description: 'Send welcome email to new newsletter subscribers',
                    triggerType: 'custom_event',
                    triggerConfig: { eventName: 'newsletter_signup' },
                    isActive: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    actions: [
                        { actionType: 'email', actionConfig: { subject: 'Welcome!', template: 'welcome' } }
                    ]
                }
            ],
            total: 1
        };
    }
    const response = await api.get(`/websites/${websiteId}/automations`);
    return response.data;
}

async function createAutomation(websiteId: string, data: CreateAutomationRequest): Promise<Automation> {
    const response = await api.post(`/websites/${websiteId}/automations`, data);
    return response.data;
}

async function updateAutomation(websiteId: string, automationId: string, data: Partial<CreateAutomationRequest>): Promise<Automation> {
    const response = await api.put(`/websites/${websiteId}/automations/${automationId}`, data);
    return response.data;
}

async function deleteAutomation(websiteId: string, automationId: string): Promise<void> {
    await api.delete(`/websites/${websiteId}/automations/${automationId}`);
}

async function toggleAutomation(websiteId: string, automationId: string): Promise<Automation> {
    const response = await api.post(`/websites/${websiteId}/automations/${automationId}/toggle`);
    return response.data;
}

async function getAutomationStats(websiteId: string, automationId: string): Promise<AutomationStats> {
    const response = await api.get(`/websites/${websiteId}/automations/${automationId}/stats`);
    return response.data;
}

// React Query Hooks
export function useAutomations(websiteId: string) {
    return useQuery({
        queryKey: ['automations', websiteId],
        queryFn: () => fetchAutomations(websiteId),
        enabled: !!websiteId,
    });
}

export function useCreateAutomation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ websiteId, data }: { websiteId: string; data: CreateAutomationRequest }) =>
            createAutomation(websiteId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['automations', variables.websiteId] });
        },
    });
}

export function useUpdateAutomation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ websiteId, automationId, data }: { websiteId: string; automationId: string; data: Partial<CreateAutomationRequest> }) =>
            updateAutomation(websiteId, automationId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['automations', variables.websiteId] });
        },
    });
}

export function useDeleteAutomation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ websiteId, automationId }: { websiteId: string; automationId: string }) =>
            deleteAutomation(websiteId, automationId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['automations', variables.websiteId] });
        },
    });
}

export function useToggleAutomation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ websiteId, automationId }: { websiteId: string; automationId: string }) =>
            toggleAutomation(websiteId, automationId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['automations', variables.websiteId] });
        },
    });
}

export function useAutomationStats(websiteId: string, automationId: string) {
    return useQuery({
        queryKey: ['automation-stats', websiteId, automationId],
        queryFn: () => getAutomationStats(websiteId, automationId),
        enabled: !!websiteId && !!automationId,
    });
}
